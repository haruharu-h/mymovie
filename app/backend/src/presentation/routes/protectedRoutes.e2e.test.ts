import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../../buildApp.js'
import { makeAuthenticate } from '../middleware/authenticate.js'
import { GetReviews } from '../../application/review/GetReviews.js'
import { CreateReview } from '../../application/review/CreateReview.js'
import { UpdateReview } from '../../application/review/UpdateReview.js'
import { DeleteReview } from '../../application/review/DeleteReview.js'
import type { IReviewRepository } from '../../domain/review/IReviewRepository.js'
import type { JwtService } from '../../application/shared/JwtService.js'
import type { Logger } from 'pino'

// authenticate ミドルウェア（preHandler）が HTTP レベルで正しく効くかを検証する E2E。
describe('protected routes (E2E) — authenticate', () => {
  let reviewRepository: jest.Mocked<IReviewRepository>
  let jwtService: jest.Mocked<JwtService>
  let logger: jest.Mocked<Logger>
  let app: FastifyInstance

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
      { logger: false },
    )
  })

  afterEach(async () => {
    await app.close()
  })

  it('Authorization ヘッダーが無ければ 401（ユースケースは呼ばれない）', async () => {
    const res = await app.inject({ method: 'GET', url: '/reviews' })

    expect(res.statusCode).toBe(401)
    expect(reviewRepository.findAllByUserId).not.toHaveBeenCalled()
  })

  it('有効な Bearer トークンなら通過して 200', async () => {
    jwtService.verifyAccessToken.mockResolvedValue({ userId: 'user-1' })
    reviewRepository.findAllByUserId.mockResolvedValue([])

    const res = await app.inject({
      method: 'GET',
      url: '/reviews',
      headers: { authorization: 'Bearer valid-token' },
    })

    expect(res.statusCode).toBe(200)
    expect(reviewRepository.findAllByUserId).toHaveBeenCalledWith('user-1', 'registeredAt')
  })

  it('トークンが無効（verifyAccessToken が例外を投げる）なら 401（ユースケースは呼ばれない）', async () => {
    jwtService.verifyAccessToken.mockRejectedValue(new Error('invalid token'))

    const res = await app.inject({
      method: 'GET',
      url: '/reviews',
      headers: { authorization: 'Bearer invalid-token' },
    })

    expect(res.statusCode).toBe(401)
    expect(reviewRepository.findAllByUserId).not.toHaveBeenCalled()
  })
})
