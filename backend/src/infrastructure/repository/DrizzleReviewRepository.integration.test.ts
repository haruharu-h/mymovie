import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, createTestMovie, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleReviewRepository } from './DrizzleReviewRepository.js'
import { Review } from '../../domain/review/Review.js'
import { Score } from '../../domain/review/Score.js'
import { AppError } from '../../domain/shared/AppError.js'

describe('DrizzleReviewRepository', () => {
  let testDb: TestDb
  let repository: DrizzleReviewRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleReviewRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findById', () => {
    it('保存したレビューをIDで取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const movie = await createTestMovie(testDb.db)
      const review = new Review('77777777-7777-7777-7777-777777777777', user.id, movie.id, Score.create(4.5), new Date())

      await repository.save(review)
      const found = await repository.findById(review.id)

      expect(found?.score.value).toBe(4.5)
    })

    it('同じユーザー・同じ映画への重複レビューはAppError(409)を投げる', async () => {
      const user = await createTestUser(testDb.db)
      const movie = await createTestMovie(testDb.db)
      await repository.save(new Review('77777777-7777-7777-7777-777777777777', user.id, movie.id, Score.create(4.5), new Date()))

      await expect(
        repository.save(new Review('88888888-8888-8888-8888-888888888888', user.id, movie.id, Score.create(3.0), new Date())),
      ).rejects.toThrow(AppError)
    })
  })

  describe('update / delete', () => {
    it('スコアを更新できる', async () => {
      const user = await createTestUser(testDb.db)
      const movie = await createTestMovie(testDb.db)
      const review = new Review('77777777-7777-7777-7777-777777777777', user.id, movie.id, Score.create(4.5), new Date())
      await repository.save(review)

      await repository.update(review.withScore(Score.create(2.0)))
      const found = await repository.findById(review.id)

      expect(found?.score.value).toBe(2.0)
    })

    it('レビューを削除できる', async () => {
      const user = await createTestUser(testDb.db)
      const movie = await createTestMovie(testDb.db)
      const review = new Review('77777777-7777-7777-7777-777777777777', user.id, movie.id, Score.create(4.5), new Date())
      await repository.save(review)

      await repository.delete(review.id)

      expect(await repository.findById(review.id)).toBeNull()
    })
  })

  describe('findAllByUserId', () => {
    it('スコア降順で並び替えて取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const movieA = await createTestMovie(testDb.db, { title: '映画A' })
      const movieB = await createTestMovie(testDb.db, { title: '映画B' })
      await repository.save(new Review(crypto.randomUUID(), user.id, movieA.id, Score.create(2.0), new Date()))
      await repository.save(new Review(crypto.randomUUID(), user.id, movieB.id, Score.create(4.0), new Date()))

      const found = await repository.findAllByUserId(user.id, 'score')

      expect(found.map(r => r.movie.title)).toEqual(['映画B', '映画A'])
    })
  })

  describe('findAllByMovieId', () => {
    it('その映画を評価した全ユーザーのレビューを取得できる', async () => {
      const userA = await createTestUser(testDb.db, { name: 'ユーザーA' })
      const userB = await createTestUser(testDb.db, { name: 'ユーザーB' })
      const movie = await createTestMovie(testDb.db)
      await repository.save(new Review(crypto.randomUUID(), userA.id, movie.id, Score.create(3.0), new Date()))
      await repository.save(new Review(crypto.randomUUID(), userB.id, movie.id, Score.create(5.0), new Date()))

      const found = await repository.findAllByMovieId(movie.id)

      expect(found).toHaveLength(2)
      expect(found.map(r => r.user.name).sort()).toEqual(['ユーザーA', 'ユーザーB'])
    })
  })
})
