import argon2 from 'argon2'
import { AppError } from '../shared/AppError.js'

export class Password {
  private constructor(readonly value: string) {}

  static async create(raw: string): Promise<Password> {
    if (raw.length < 8) {
      throw new AppError('パスワードは8文字以上にしてください', 400)
    }
    // parallelismのみデフォルト(4)から下げる。メモリ量・反復回数は変えない。
    // 1vCPU環境ではparallelism:4は並列化の恩恵が無いままlibuvスレッドプール
    // （既定サイズ4）を独占し、無関係な処理を巻き込む（docs/decisions.md「フェーズ7-5」
    // トラックB参照）。同じメモリ量ならparallelismが低い方がGPU等の並列攻撃にも強くなるため、
    // 強度を落とさずに済む（OWASP Password Storage Cheat Sheet参照）
    const hash = await argon2.hash(raw, { parallelism: 1 })
    return new Password(hash)
  }

  static reconstruct(hash: string): Password {
    return new Password(hash)
  }

  async verify(raw: string): Promise<boolean> {
    return argon2.verify(this.value, raw)
  }
}
