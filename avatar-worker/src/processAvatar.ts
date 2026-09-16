import { ApiError, type Storage } from '@google-cloud/storage'
import { transformAvatarImage } from './imageTransform.js'
import { isAlreadyProcessed, PROCESSED_METADATA_KEY } from './selfCheckGuard.js'

// EventarcがGCSの`google.cloud.storage.object.v1.finalized`イベントで渡すCloudEventの
// data部分。実際に使うフィールドのみ型定義する
export type StorageObjectFinalizedData = {
  bucket: string
  name: string
}

export async function processAvatarObject(storage: Storage, data: StorageObjectFinalizedData): Promise<void> {
  const file = storage.bucket(data.bucket).file(data.name)

  // イベントに含まれるmetadataスナップショットではなく、GCSの現在の実体を都度問い合わせる。
  // イベントのmetadataは「発火した時点」のものなので、Eventarc/Pub-Subが同じイベントを
  // 本当に重複配信した場合（自己上書きによる新規イベントではなく、単なる再送）、
  // スナップショットは「未処理だった時点」のまま古くなっており、実際には既に処理済みでも
  // 見逃してしまう（実機テストで発見）。常に最新のメタデータを見ることで、自己上書きに
  // よる再発火と、Eventarc自体の重複配信の両方を同じ仕組みで防げる
  const [liveMetadata] = await file.getMetadata()
  if (isAlreadyProcessed(liveMetadata.metadata)) {
    console.log(`Skipping already-processed object: ${data.name}`)
    return
  }

  const [buffer] = await file.download()

  const processed = await transformAvatarImage(buffer)

  try {
    // liveMetadataを読んでから処理する間に、より新しいアバターが再アップロードされている
    // 可能性がある（処理に時間がかかるほど起こりやすい）。ifGenerationMatchで
    // 「読んだ時点の世代のままなら保存する」という条件を付け、古い処理結果が新しい
    // アップロードを上書きしてしまう競合を防ぐ
    await file.save(processed, {
      contentType: 'image/jpeg',
      metadata: { metadata: { [PROCESSED_METADATA_KEY]: 'true' } },
      preconditionOpts: { ifGenerationMatch: liveMetadata.generation },
    })
  } catch (error) {
    if (error instanceof ApiError && error.code === 412) {
      // 世代競合＝処理中により新しいアップロードが上書きしていた、という想定内のケース。
      // その新しいアップロード自体が別のイベントを発火させ、あらためて処理されるため、
      // ここでは何もせず正常終了する
      console.log(`Skipping stale write due to generation conflict: ${data.name}`)
      return
    }
    throw error
  }

  console.log(`Processed avatar: ${data.name}`)
}
