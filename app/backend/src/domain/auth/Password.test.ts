import { describe, it, expect } from '@jest/globals'
import { Password } from './Password.js'
import { AppError } from '../shared/AppError.js'

describe('Password', () => {
  describe('create', () => {
    it('8文字以上ならハッシュ化した Password を返す', async () => {
      const password = await Password.create('password123')

      // argon2 は毎回ソルトが変わるためハッシュ値は固定できない。
      // → 「生パスワードそのままではないこと」＋「正しい生値で verify が通ること」で検証する
      expect(password.value).not.toBe('password123')
      expect(await password.verify('password123')).toBe(true)
    })

    it('OWASP "minimum" プリセット（m=19456, t=2, p=1）でハッシュ化する', async () => {
      const password = await Password.create('password123')
      // argon2のハッシュ文字列は $argon2id$v=19$m=...,t=...,p=...$... のように
      // 使用したパラメータ自体を埋め込む形式になっている
      expect(password.value).toContain('$m=19456,t=2,p=1$')
    })

    it('8文字ちょうどは通る（境界値）', async () => {
      const password = await Password.create('12345678')
      expect(await password.verify('12345678')).toBe(true)
    })

    it('8文字未満なら AppError(400) を投げる', async () => {
      expect.assertions(2) // catch を素通りせず expect が2回実行されることを保証
      try {
        await Password.create('short')
      } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).statusCode).toBe(400)
      }
    })
  })

  describe('verify', () => {
    it('間違った生パスワードには false を返す', async () => {
      const password = await Password.create('password123')
      expect(await password.verify('wrongpassword')).toBe(false)
    })
  })

  describe('reconstruct', () => {
    it('既存ハッシュから Password を復元する（ハッシュ化はしない）', () => {
      const stored = 'already-hashed-value'
      const password = Password.reconstruct(stored)
      // 復元はDBの生データをそのまま包むだけ。値が保たれる
      expect(password.value).toBe(stored)
    })
  })
})
