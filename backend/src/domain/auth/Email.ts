import { AppError } from '../shared/AppError.js'

export class Email {
  private constructor(readonly value: string) {}

  static create(value: string): Email {
    if (!value.includes('@')) {
      throw new AppError('無効なメールアドレスです', 400)
    }
    return new Email(value)
  }
}
