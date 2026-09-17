import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleIdentityRepository } from './DrizzleIdentityRepository.js'
import { Identity } from '../../domain/auth/Identity.js'

describe('DrizzleIdentityRepository', () => {
  let testDb: TestDb
  let repository: DrizzleIdentityRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleIdentityRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findByProviderAndProviderId', () => {
    it('保存したIdentityをprovider+providerIdで取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const identity = new Identity('22222222-2222-2222-2222-222222222222', user.id, 'email', 'yamada@example.com', 'hashed-password', new Date())

      await repository.save(identity)
      const found = await repository.findByProviderAndProviderId('email', 'yamada@example.com')

      expect(found).toEqual(identity)
    })

    it('存在しないprovider+providerIdの場合はnullを返す', async () => {
      const found = await repository.findByProviderAndProviderId('google', 'not-exist')

      expect(found).toBeNull()
    })

    it('同じprovider+providerIdの組は一意制約により重複登録できない', async () => {
      const user = await createTestUser(testDb.db)
      await repository.save(new Identity('22222222-2222-2222-2222-222222222222', user.id, 'email', 'dup@example.com', 'hash1', new Date()))

      await expect(
        repository.save(new Identity('33333333-3333-3333-3333-333333333333', user.id, 'email', 'dup@example.com', 'hash2', new Date())),
      ).rejects.toThrow()
    })
  })

  describe('findByUserIdAndProvider', () => {
    it('userId+providerでIdentityを取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const identity = new Identity('22222222-2222-2222-2222-222222222222', user.id, 'email', 'yamada@example.com', 'hashed-password', new Date())
      await repository.save(identity)

      const found = await repository.findByUserIdAndProvider(user.id, 'email')

      expect(found).toEqual(identity)
    })

    it('存在しない組み合わせの場合はnullを返す', async () => {
      const user = await createTestUser(testDb.db)

      const found = await repository.findByUserIdAndProvider(user.id, 'google')

      expect(found).toBeNull()
    })
  })

  describe('updatePasswordHash', () => {
    it('passwordHashを更新できる', async () => {
      const user = await createTestUser(testDb.db)
      const identity = new Identity('22222222-2222-2222-2222-222222222222', user.id, 'email', 'yamada@example.com', 'old-hash', new Date())
      await repository.save(identity)

      await repository.updatePasswordHash(identity.id, 'new-hash')

      const found = await repository.findByUserIdAndProvider(user.id, 'email')
      expect(found?.passwordHash).toBe('new-hash')
    })
  })
})
