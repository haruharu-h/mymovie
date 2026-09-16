import { describe, it, expect } from '@jest/globals'
import { Review } from './Review.js'
import { Score } from './Score.js'

const buildReview = (userId: string): Review =>
  new Review('review-1', userId, 'movie-1', Score.create(3), new Date('2026-01-01'))

describe('Review', () => {
  describe('withScore（イミュータブル）', () => {
    it('新しいスコアを持つ別インスタンスを返し、元は変わらない', () => {
      const original = buildReview('user-1')
      const updated = original.withScore(Score.create(4.5))

      expect(updated).not.toBe(original)          // 別インスタンス
      expect(updated.score.value).toBe(4.5)       // 新しいスコア
      expect(original.score.value).toBe(3)        // 元は不変
      // score 以外は引き継ぐ
      expect(updated.id).toBe(original.id)
      expect(updated.userId).toBe(original.userId)
      expect(updated.movieId).toBe(original.movieId)
      expect(updated.registeredAt).toBe(original.registeredAt)
    })
  })

  describe('canBeDeletedBy / canBeUpdatedBy（認可）', () => {
    it('所有者なら true', () => {
      const review = buildReview('user-1')
      expect(review.canBeDeletedBy('user-1')).toBe(true)
      expect(review.canBeUpdatedBy('user-1')).toBe(true)
    })

    it('他人なら false', () => {
      const review = buildReview('user-1')
      expect(review.canBeDeletedBy('other-user')).toBe(false)
      expect(review.canBeUpdatedBy('other-user')).toBe(false)
    })
  })
})
