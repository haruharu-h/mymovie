import { describe, it, expect } from '@jest/globals'
import { Email } from './Email.js'
import { AppError } from '../shared/AppError.js'

// describe: 関連するテストをまとめるグループ。「何についてのテストか」を書く
describe('Email', () => {
  // it: 1つのテストケース。「〜であるべき」という期待を文で書く
  it('@ を含む文字列なら Email インスタンスを返す', () => {
    const email = Email.create('user@example.com')

    // expect(実際の値).matcher(期待する値) の形で検証する
    expect(email.value).toBe('user@example.com')
  })

  it('@ を含まない文字列なら AppError(400) を投げる', () => {
    // throw を検証するときは「関数として」渡す（即時実行すると throw でテストが止まるため）
    expect(() => Email.create('invalid')).toThrow(AppError)

    // さらに statusCode が 400 であることまで確認する
    try {
      Email.create('invalid')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(400)
    }
  })
})
