import argon2 from 'argon2'
import { AppError } from '../shared/AppError.js'

export class Password {
  private constructor(readonly value: string) {}

  static async create(raw: string): Promise<Password> {
    if (raw.length < 8) {
      throw new AppError('パスワードは8文字以上にしてください', 400)
    }
    const hash = await argon2.hash(raw)
    return new Password(hash)
  }

  static reconstruct(hash: string): Password {
    return new Password(hash)
  }

  async verify(raw: string): Promise<boolean> {
    return argon2.verify(this.value, raw)
  }
}
