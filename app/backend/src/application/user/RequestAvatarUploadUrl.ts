import { AppError } from '../../domain/shared/AppError.js'
import type { AvatarUploadPolicy, GcsAvatarSigner } from '../../infrastructure/external/GcsAvatarSigner.js'

// 対応する画像形式の許可リスト（構造的な制約はZodが担うが、これは値の中身に関する
// ビジネスルールのため値オブジェクトが無いこのユースケースで判定する）
const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export class RequestAvatarUploadUrl {
  constructor(private readonly gcsAvatarSigner: GcsAvatarSigner) {}

  async execute(userId: string, contentType: string): Promise<AvatarUploadPolicy> {
    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      throw new AppError('対応していない画像形式です', 400)
    }

    return this.gcsAvatarSigner.createUploadPolicy(userId, contentType)
  }
}
