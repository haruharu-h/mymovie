import { Storage } from '@google-cloud/storage'

export type AvatarUploadPolicy = {
  uploadUrl: string
  fields: Record<string, string>
}

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
const POLICY_EXPIRES_MS = 5 * 60 * 1000

export class GcsAvatarSigner {
  private readonly bucketName: string
  private readonly storage: Storage

  constructor() {
    const bucketName = process.env.AVATAR_BUCKET_NAME
    if (!bucketName) throw new Error('AVATAR_BUCKET_NAME is not set')
    this.bucketName = bucketName
    this.storage = new Storage()
  }

  // ユーザー1人につき1オブジェクトの固定パス。再アップロードは常に上書きになるため、
  // 孤立ファイルの発生・削除用のライフサイクルルールの管理が不要になる
  private objectKey(userId: string): string {
    return `avatars/${userId}`
  }

  // サイズ・Content-Typeの制約はconditionsとしてGCS自身に強制させる
  // （クライアント側のチェックだけに頼らない。`docs/security.md`の「クライアントを信用しない」方針）
  async createUploadPolicy(userId: string, contentType: string): Promise<AvatarUploadPolicy> {
    const file = this.storage.bucket(this.bucketName).file(this.objectKey(userId))
    const [policy] = await file.generateSignedPostPolicyV4({
      expires: Date.now() + POLICY_EXPIRES_MS,
      conditions: [
        ['content-length-range', 0, MAX_AVATAR_SIZE_BYTES],
        ['eq', '$Content-Type', contentType],
      ],
    })
    return { uploadUrl: policy.url, fields: policy.fields }
  }

  // クライアントからの入力に依存せず、バケット名+userId+versionだけから決まる値。
  // オブジェクトキーはuserIdごとに固定（再アップロードは常に上書き）なため、URLも
  // versionを付けない限りアップロードのたびに同じ文字列になり、ブラウザ/中間キャッシュが
  // GCSのデフォルトCache-Control（`public, max-age=3600`）に従って最大1時間古い画像を
  // 返し続けてしまう。versionをクエリパラメータとして付与し、更新のたびに別URL扱いにする
  // ことでキャッシュを強制的に無効化する（`docs/decisions.md`「アバター画像の
  // キャッシュ無効化」参照）
  getPublicUrl(userId: string, version: number): string {
    return `https://storage.googleapis.com/${this.bucketName}/${this.objectKey(userId)}?v=${version}`
  }

  // 実際にアップロードが完了したかどうかをGCS自身に問い合わせて確認する
  async objectExists(userId: string): Promise<boolean> {
    const [exists] = await this.storage.bucket(this.bucketName).file(this.objectKey(userId)).exists()
    return exists
  }
}
