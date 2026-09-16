import { describe, it, expect } from '@jest/globals'
import sharp from 'sharp'
import { transformAvatarImage } from './imageTransform.js'

// EXIF付きの300x300テスト画像を作る（スマホ写真のGPS付きJPEGを模したもの）
async function createTestImageWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 300, height: 300, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .withExif({ IFD0: { Make: 'TestCamera', Model: 'Pixel Test' } })
    .jpeg()
    .toBuffer()
}

describe('transformAvatarImage', () => {
  it('192x192のJPEGにリサイズし、EXIFを除去する', async () => {
    const original = await createTestImageWithExif()
    const originalMeta = await sharp(original).metadata()
    expect(originalMeta.exif).toBeDefined() // 前提: 入力には確かにEXIFが含まれている

    const result = await transformAvatarImage(original)
    const resultMeta = await sharp(result).metadata()

    expect(resultMeta.width).toBe(192)
    expect(resultMeta.height).toBe(192)
    expect(resultMeta.format).toBe('jpeg')
    expect(resultMeta.exif).toBeUndefined()
  })

  it('入力がPNGでも常にJPEGに変換する', async () => {
    const pngInput = await sharp({
      create: { width: 300, height: 300, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer()

    const result = await transformAvatarImage(pngInput)
    const resultMeta = await sharp(result).metadata()

    expect(resultMeta.format).toBe('jpeg')
  })

  it('EXIFのOrientationタグ通りに回転してからリサイズする', async () => {
    // 横長(400x100)の生ピクセル。左半分=赤、右半分=青。
    // Orientation=6（表示には90°時計回りの回転が必要、というヒント）を付ける。
    // rotate()を先に呼んでいれば、回転後は縦長(100x400)になり、上半分=赤、下半分=青になる
    // （左右の境目が上下の境目に変わる）。rotate()を呼び忘れていると、境目は左右のまま
    const width = 400
    const height = 100
    const raw = Buffer.alloc(width * height * 3)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 3
        const isLeftHalf = x < width / 2
        raw[i] = isLeftHalf ? 255 : 0 // R
        raw[i + 1] = 0 // G
        raw[i + 2] = isLeftHalf ? 0 : 255 // B
      }
    }
    const original = await sharp(raw, { raw: { width, height, channels: 3 } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer()

    const result = await transformAvatarImage(original)
    const { data, info } = await sharp(result).raw().toBuffer({ resolveWithObject: true })
    const pixelAt = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels
      return { r: data[i], g: data[i + 1], b: data[i + 2] }
    }

    const centerX = Math.floor(info.width / 2)
    const top = pixelAt(centerX, Math.floor(info.height * 0.2))
    const bottom = pixelAt(centerX, Math.floor(info.height * 0.8))

    // 正しく回転していれば上=赤寄り・下=青寄りになる（回転していなければ
    // 中央列は赤と青の境目付近になり、この差が出ない）
    expect(top.r).toBeGreaterThan(top.b)
    expect(bottom.b).toBeGreaterThan(bottom.r)
  })
})
