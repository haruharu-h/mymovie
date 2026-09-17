import { AppError } from '../shared/AppError.js'

export class UserName {
  private constructor(readonly value: string) {}

  static create(value: string): UserName {
    const trimmed = value.trim()
    if (trimmed === '') {
      throw new AppError('名前を入力してください', 400)
    }
    return new UserName(trimmed)
  }
}
