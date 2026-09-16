import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { DeleteReview } from './DeleteReview.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { AppError } from '../../domain/shared/AppError.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'

// テスト用の Review を組み立てるヘルパー。userId を差し替えて「本人/他人」を作り分ける
const buildReview = (userId: string): Review =>
  new Review('review-1', userId, 'movie-1', Score.create(3), new Date())

describe('DeleteReview', () => {
  // jest.Mocked<T> = インターフェースの全メソッドを「モック関数」に置き換えた型。
  // これで reviewRepository.findById.mockResolvedValue(...) のように操作できる。
  let reviewRepository: jest.Mocked<IReviewRepository>
  let deleteReview: DeleteReview

  beforeEach(() => {
    // IReviewRepository の偽物。使わないメソッドも interface を満たすため全部 jest.fn() で用意する。
    // jest.fn<...>() に「その関数の型」を渡すと、返り値や引数が型安全になる。
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    deleteReview = new DeleteReview(reviewRepository)
  })

  it('レビューが存在しなければ AppError(404) を投げ、delete は呼ばない', async () => {
    reviewRepository.findById.mockResolvedValue(null) // 「見つからない」状況を作る

    expect.assertions(3)
    try {
      await deleteReview.execute('review-1', 'user-1')
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(404)
    }
    expect(reviewRepository.delete).not.toHaveBeenCalled()
  })

  it('他人のレビューなら AppError(403) を投げ、delete は呼ばない', async () => {
    reviewRepository.findById.mockResolvedValue(buildReview('owner-user')) // 所有者は別人

    expect.assertions(3)
    try {
      await deleteReview.execute('review-1', 'other-user') // 別ユーザーが削除を試みる
    } catch (e) {
      expect(e).toBeInstanceOf(AppError)
      expect((e as AppError).statusCode).toBe(403)
    }
    expect(reviewRepository.delete).not.toHaveBeenCalled()
  })

  it('本人のレビューなら delete を正しい id で呼ぶ', async () => {
    reviewRepository.findById.mockResolvedValue(buildReview('user-1')) // 所有者＝実行者

    await deleteReview.execute('review-1', 'user-1')

    // 「消えたか」ではなく「正しい id で delete を指示したか」を検証する
    expect(reviewRepository.delete).toHaveBeenCalledWith('review-1')
    expect(reviewRepository.delete).toHaveBeenCalledTimes(1)
  })
})
