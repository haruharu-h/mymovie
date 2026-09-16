import { describe, it, expect } from '@jest/globals'
import { Score } from './Score.js'
import { AppError } from '../shared/AppError.js'

describe('Score', () => {
  describe('create（境界値）', () => {
    it.each([0, 0.1, 2.5, 4.9, 5])('有効な値 %p は作成できる', (value) => {
      expect(Score.create(value).value).toBe(value)
    })

    it.each([-0.1, 5.1, -1, 6])('範囲外 %p は AppError(400)', (value) => {
      expect(() => Score.create(value)).toThrow(AppError)
      try {
        Score.create(value)
      } catch (e) {
        expect((e as AppError).statusCode).toBe(400)
      }
    })

    it('0.1刻みでない値（0.15）は AppError(400)', () => {
      expect(() => Score.create(0.15)).toThrow(AppError)
    })
  })

  describe('reconstruct（DB復元用・検証しない）', () => {
    it('範囲外の値でもそのまま復元する', () => {
      // DBの生データを信頼して復元するため create のような検証はしない
      expect(Score.reconstruct(99).value).toBe(99)
    })
  })
})
