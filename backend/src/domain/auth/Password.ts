import argon2 from 'argon2'
import { AppError } from '../shared/AppError.js'

export class Password {
  private constructor(readonly value: string) {}

  static async create(raw: string): Promise<Password> {
    if (raw.length < 8) {
      throw new AppError('パスワードは8文字以上にしてください', 400)
    }
    // OWASP Password Storage Cheat SheetのArgon2id "minimum" プリセット
    // （m=19456 KiB=19MiB, t=2, p=1）を採用。
    // parallelism:1は1vCPU環境でlibuvスレッドプール（既定サイズ4）を独占し無関係な
    // 処理を巻き込む問題への対処（docs/decisions.md「フェーズ7-5」トラックB参照）。
    // memoryCostを64MiBから19MiBに下げたのは、Cloud Runのメモリ上限your-cloud-run-memory-limitに対し
    // 64MiB/回だと同時に2件重なっただけでOOMが起きる余地の無さが分かったため
    // （本番の実測値は非公開）。GPU/ASICでの総当たり攻撃への
    // 耐性は下がるが、OWASPが正式に許容する範囲内での選択（docs/decisions.md参照）
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
