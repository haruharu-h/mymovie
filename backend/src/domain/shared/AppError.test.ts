import { describe, it, expect } from '@jest/globals'
import { AppError } from './AppError.js'

describe('AppError', () => {
  it('message・statusCode・name が正しく設定され、Error/AppError のインスタンスになる', () => {
    const error = new AppError('無効なメールアドレスです', 400)

    expect(error.message).toBe('無効なメールアドレスです')
    expect(error.statusCode).toBe(400)
    expect(error.name).toBe('AppError')
    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(AppError)
  })
})
