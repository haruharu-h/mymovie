import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleVerificationTokenRepository } from './DrizzleVerificationTokenRepository.js'
import { VerificationToken } from '../../domain/auth/VerificationToken.js'

describe('DrizzleVerificationTokenRepository', () => {
  let testDb: TestDb
  let repository: DrizzleVerificationTokenRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleVerificationTokenRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findByTokenHash', () => {
    it('保存したトークンをtokenHashで取得できる', async () => {
      const user = await createTestUser(testDb.db)
      const token = new VerificationToken(
        '44444444-4444-4444-4444-444444444444',
        user.id,
        'password_reset',
        'hashed-token',
        new Date('2030-01-01'),
        null,
        new Date(),
      )

      await repository.save(token)
      const found = await repository.findByTokenHash('hashed-token')

      expect(found).toEqual(token)
    })

    it('存在しないhashの場合はnullを返す', async () => {
      const found = await repository.findByTokenHash('not-exist')

      expect(found).toBeNull()
    })
  })

  describe('markConsumed', () => {
    it('consumedAtを設定できる', async () => {
      const user = await createTestUser(testDb.db)
      const token = new VerificationToken(
        '44444444-4444-4444-4444-444444444444',
        user.id,
        'password_reset',
        'hashed-token',
        new Date('2030-01-01'),
        null,
        new Date(),
      )
      await repository.save(token)

      const consumedAt = new Date('2026-01-01T00:00:00.000Z')
      await repository.markConsumed(token.id, consumedAt)

      const found = await repository.findByTokenHash('hashed-token')
      expect(found?.consumedAt).toEqual(consumedAt)
    })
  })

  describe('deleteActiveByUserIdAndPurpose', () => {
    it('同じユーザー・同じ用途の未使用トークンを削除する', async () => {
      const user = await createTestUser(testDb.db)
      const token = new VerificationToken(
        '44444444-4444-4444-4444-444444444444',
        user.id,
        'password_reset',
        'hashed-token',
        new Date('2030-01-01'),
        null,
        new Date(),
      )
      await repository.save(token)

      await repository.deleteActiveByUserIdAndPurpose(user.id, 'password_reset')

      expect(await repository.findByTokenHash('hashed-token')).toBeNull()
    })

    it('使用済みトークンは削除しない', async () => {
      const user = await createTestUser(testDb.db)
      const token = new VerificationToken(
        '44444444-4444-4444-4444-444444444444',
        user.id,
        'password_reset',
        'hashed-token',
        new Date('2030-01-01'),
        new Date(),
        new Date(),
      )
      await repository.save(token)

      await repository.deleteActiveByUserIdAndPurpose(user.id, 'password_reset')

      expect(await repository.findByTokenHash('hashed-token')).not.toBeNull()
    })

    it('用途が異なるトークンは削除しない', async () => {
      const user = await createTestUser(testDb.db)
      const token = new VerificationToken(
        '44444444-4444-4444-4444-444444444444',
        user.id,
        'email_confirmation',
        'hashed-token',
        new Date('2030-01-01'),
        null,
        new Date(),
      )
      await repository.save(token)

      await repository.deleteActiveByUserIdAndPurpose(user.id, 'password_reset')

      expect(await repository.findByTokenHash('hashed-token')).not.toBeNull()
    })
  })
})
