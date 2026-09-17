import { describe, it, expect } from '@jest/globals'
import { UserName } from './UserName.js'
import { AppError } from '../shared/AppError.js'

describe('UserName', () => {
  it('前後の空白を除いた値で UserName インスタンスを返す', () => {
    const name = UserName.create('  Alice  ')

    expect(name.value).toBe('Alice')
  })

  it('空白のみの文字列なら AppError(400) を投げる', () => {
    expect(() => UserName.create('   ')).toThrow(AppError)

    try {
      UserName.create('   ')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }
  })
})
