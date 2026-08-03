import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleMovieRepository } from './DrizzleMovieRepository.js'
import { Movie } from '../../domain/movie/Movie.js'

describe('DrizzleMovieRepository', () => {
  let testDb: TestDb
  let repository: DrizzleMovieRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleMovieRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findById', () => {
    it('保存した映画をIDで取得できる', async () => {
      const movie = new Movie('movie-1', 'タイトル', '/poster.jpg', '2024-01-01', new Date())

      await repository.save(movie)
      const found = await repository.findById('movie-1')

      expect(found).toEqual(movie)
    })

    it('存在しないIDの場合はnullを返す', async () => {
      const found = await repository.findById('not-exist')

      expect(found).toBeNull()
    })

    it('同じIDで保存しても重複せず既存の行を保持する', async () => {
      const movie = new Movie('movie-1', 'タイトル', '/poster.jpg', '2024-01-01', new Date())
      await repository.save(movie)

      await repository.save(new Movie('movie-1', '別タイトル', '/other.jpg', '2025-01-01', new Date()))
      const found = await repository.findById('movie-1')

      expect(found?.title).toBe('タイトル')
    })
  })
})
