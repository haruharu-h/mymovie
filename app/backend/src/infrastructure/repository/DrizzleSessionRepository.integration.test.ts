import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleSessionRepository } from './DrizzleSessionRepository.js'
import { Session } from '../../domain/auth/Session.js'

describe('DrizzleSessionRepository', () => {
  let testDb: TestDb
  let repository: DrizzleSessionRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleSessionRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findByRefreshTokenHash', () => {
    it('保存したセッションをrefreshTokenHashで取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const session = new Session('44444444-4444-4444-4444-444444444444', user.id, 'hashed-refresh-token', new Date('2030-01-01'), new Date())

      await repository.save(session)
      const found = await repository.findByRefreshTokenHash('hashed-refresh-token')

      expect(found).toEqual(session)
    })

    it('存在しないhashの場合はnullを返す', async () => {
      const found = await repository.findByRefreshTokenHash('not-exist')

      expect(found).toBeNull()
    })
  })

  describe('updateRefreshTokenHash', () => {
    it('refreshTokenHashをローテーションできる', async () => {
      const user = await createTestUser(testDb.db)
      const session = new Session('44444444-4444-4444-4444-444444444444', user.id, 'old-hash', new Date('2030-01-01'), new Date())
      await repository.save(session)

      await repository.updateRefreshTokenHash(session.id, 'new-hash')

      expect(await repository.findByRefreshTokenHash('old-hash')).toBeNull()
      expect(await repository.findByRefreshTokenHash('new-hash')).not.toBeNull()
    })
  })

  describe('delete', () => {
    it('セッションを削除できる（ログアウト）', async () => {
      const user = await createTestUser(testDb.db)
      const session = new Session('44444444-4444-4444-4444-444444444444', user.id, 'hash', new Date('2030-01-01'), new Date())
      await repository.save(session)

      await repository.delete(session.id)

      expect(await repository.findByRefreshTokenHash('hash')).toBeNull()
    })
  })
})
