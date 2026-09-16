import argon2 from 'argon2'
import { AppError } from '../shared/AppError.js'

export class Password {
  private constructor(readonly value: string) {}

  static async create(raw: string): Promise<Password> {
    if (raw.length < 8) {
      throw new AppError('パスワードは8文字以上にしてください', 400)
    }
    // OWASP Password Storage Cheat SheetのArgon2id "minimum" プリセット
    // （m=19456 KiB=19MiB, t=2, p=1）を採用。Cloud Runのメモリ上限に対し標準プリセット
    // （64MiB）だと同時アクセスでOOMの余地が無く、GPU/ASIC耐性は下がるがOWASPが正式に
    // 許容する範囲で下げた。parallelism:1はlibuvスレッドプール独占対策
    // （詳細: docs/decisions.md「フェーズ7-5」トラックB）
    const hash = await argon2.hash(raw, { parallelism: 1, memoryCost: 19456, timeCost: 2 })
    return new Password(hash)
  }

  static reconstruct(hash: string): Password {
    return new Password(hash)
  }

  async verify(raw: string): Promise<boolean> {
    return argon2.verify(this.value, raw)
  }
}
