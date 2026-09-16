import sharp from 'sharp'

// 表示サイズ96pxの2倍。Retina等の高解像度ディスプレイでも粗く見えないように
// （docs/async-worker-architecture.md「リサイズ仕様」参照）
const TARGET_DIMENSION = 192

// 入力形式（jpeg/png/webp）によらず常にJPEGに変換する。PNGの透過は失われるが、
// アバター写真に透過は通常不要なため許容する（docs/async-worker-architecture.md参照）。
// sharpは.withMetadata()を呼ばない限り出力にEXIFを含めないため、リサイズと同じ処理で
// EXIF除去も同時に行える
export async function transformAvatarImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    // EXIFのOrientationタグは、実際のピクセルデータではなく「表示時にどう回転すべきか」の
    // ヒントとして格納される（スマホのカメラで撮った写真の多くがこれを持つ）。
    // rotate()を呼ばずにresize()すると、ヒントを無視した向きのままクロップされてしまい、
    // 出力はEXIFを含まない（＝表示側で補正できない）ため、見た目上回転した画像になる。
    // 引数無しのrotate()はOrientationタグを見てピクセル自体を回転させてから
    // タグを正規化するので、必ずresize()より前に呼ぶ
    .rotate()
    .resize(TARGET_DIMENSION, TARGET_DIMENSION, { fit: 'cover' })
    .jpeg()
    .toBuffer()
}
