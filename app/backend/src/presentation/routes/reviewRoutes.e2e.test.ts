import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { makeAuthenticate } from '../middleware/authenticate.js'
import { GetReviews } from '../../application/review/GetReviews.js'
import { CreateReview } from '../../application/review/CreateReview.js'
import { UpdateReview } from '../../application/review/UpdateReview.js'
import { DeleteReview } from '../../application/review/DeleteReview.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { Movie } from '../../domain/movie/Movie.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'
import type { Logger } from 'pino'

describe('reviewRoutes (E2E)', () => {
  let reviewRepository: jest.Mocked<IReviewRepository>
  let jwtService: jest.Mocked<JwtService>
  let logger: jest.Mocked<Logger>
  let app: FastifyInstance

  const authHeader = { authorization: 'Bearer valid-token' }
  const authenticatedUserId = 'user-1'

  beforeEach(() => {
    reviewRepository = {
      findAllByUserId: jest.fn<IReviewRepository['findAllByUserId']>(),
      findAllByMovieId: jest.fn<IReviewRepository['findAllByMovieId']>(),
      findById: jest.fn<IReviewRepository['findById']>(),
      save: jest.fn<IReviewRepository['save']>(),
      update: jest.fn<IReviewRepository['update']>(),
      delete: jest.fn<IReviewRepository['delete']>(),
    }
    jwtService = {
      generateAccessToken: jest.fn<JwtService['generateAccessToken']>(),
      verifyAccessToken: jest.fn<JwtService['verifyAccessToken']>(),
      hashToken: jest.fn<JwtService['hashToken']>(),
    } as unknown as jest.Mocked<JwtService>
    jwtService.verifyAccessToken.mockResolvedValue({ userId: authenticatedUserId })
    logger = { info: jest.fn() } as unknown as jest.Mocked<Logger>

    app = buildApp(
      {
        review: {
          getReviews: new GetReviews(reviewRepository),
          createReview: new CreateReview(reviewRepository, logger),
          updateReview: new UpdateReview(reviewRepository),
          deleteReview: new DeleteReview(reviewRepository),
          authenticate: makeAuthenticate(jwtService),
        },
      },
      { logger: false, forceFlushTelemetry: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /reviews', () => {
    it('不正な sort 値なら registeredAt にフォールバックする', async () => {
      reviewRepository.findAllByUserId.mockResolvedValue([])

      await app.inject({ method: 'GET', url: '/reviews?sort=invalid', headers: authHeader })

      expect(reviewRepository.findAllByUserId).toHaveBeenCalledWith(authenticatedUserId, 'registeredAt')
    })

    it('userId クエリが無ければ自分のレビューを整形して返す', async () => {
      const movie = new Movie('603', 'The Matrix', '/x.jpg', '1999-03-31', new Date())
      const review = new Review('review-1', authenticatedUserId, '603', Score.create(4.5), new Date('2026-01-01'))
      reviewRepository.findAllByUserId.mockResolvedValue([{ review, movie }])

      const res = await app.inject({ method: 'GET', url: '/reviews', headers: authHeader })

      expect(reviewRepository.findAllByUserId).toHaveBeenCalledWith(authenticatedUserId, 'registeredAt')
      expect(res.json()).toEqual({
        reviews: [
          {
            id: 'review-1',
            score: 4.5,
            registeredAt: review.registeredAt.toISOString(),
            movie: { id: '603', title: 'The Matrix', posterPath: '/x.jpg', releaseDate: '1999-03-31' },
          },
        ],
      })
    })

    it('userId クエリがあれば他ユーザーのレビューを取得する', async () => {
      reviewRepository.findAllByUserId.mockResolvedValue([])

      await app.inject({ method: 'GET', url: '/reviews?userId=other-user', headers: authHeader })

      expect(reviewRepository.findAllByUserId).toHaveBeenCalledWith('other-user', 'registeredAt')
    })
  })

  describe('POST /reviews', () => {
    it('201 で保存され、トークンの userId が使われる', async () => {
      reviewRepository.save.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'POST',
        url: '/reviews',
        headers: authHeader,
        payload: { movieId: '603', score: 4.5 },
      })

      expect(res.statusCode).toBe(201)
      const savedReview = reviewRepository.save.mock.calls[0][0]
      expect(savedReview.userId).toBe(authenticatedUserId)
      expect(savedReview.movieId).toBe('603')
      expect(savedReview.score.value).toBe(4.5)
    })

    it('scoreが無ければ 400（Zodスキーマによるバリデーション）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/reviews',
        headers: authHeader,
        payload: { movieId: '603' },
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
      expect(reviewRepository.save).not.toHaveBeenCalled()
    })
  })

  describe('PATCH /reviews/:reviewId', () => {
    it('本人のレビューなら 200 で更新される', async () => {
      const review = new Review('review-1', authenticatedUserId, '603', Score.create(3), new Date())
      reviewRepository.findById.mockResolvedValue(review)
      reviewRepository.update.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'PATCH',
        url: '/reviews/review-1',
        headers: authHeader,
        payload: { score: 4.5 },
      })

      expect(res.statusCode).toBe(200)
      expect(reviewRepository.update).toHaveBeenCalledTimes(1)
    })

    it('レビューが存在しなければ 404', async () => {
      reviewRepository.findById.mockResolvedValue(null)

      const res = await app.inject({
        method: 'PATCH',
        url: '/reviews/unknown',
        headers: authHeader,
        payload: { score: 4.5 },
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: 'レビューが見つかりません' })
    })

    it('scoreが無ければ 400（Zodスキーマによるバリデーション）', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/reviews/review-1',
        headers: authHeader,
        payload: {},
      })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ message: 'リクエストの形式が正しくありません' })
      expect(reviewRepository.findById).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /reviews/:reviewId', () => {
    it('本人のレビューなら 204 で削除される', async () => {
      const review = new Review('review-1', authenticatedUserId, '603', Score.create(3), new Date())
      reviewRepository.findById.mockResolvedValue(review)
      reviewRepository.delete.mockResolvedValue(undefined)

      const res = await app.inject({
        method: 'DELETE',
        url: '/reviews/review-1',
        headers: authHeader,
      })

      expect(res.statusCode).toBe(204)
      expect(reviewRepository.delete).toHaveBeenCalledWith('review-1')
    })

    it('レビューが存在しなければ 404', async () => {
      reviewRepository.findById.mockResolvedValue(null)

      const res = await app.inject({
        method: 'DELETE',
        url: '/reviews/unknown',
        headers: authHeader,
      })

      expect(res.statusCode).toBe(404)
      expect(res.json()).toEqual({ message: 'レビューが見つかりません' })
    })
  })
})
