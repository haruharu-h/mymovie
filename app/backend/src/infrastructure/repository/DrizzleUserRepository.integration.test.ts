import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleUserRepository } from './DrizzleUserRepository.js'
import { User } from '../../domain/user/User.js'

describe('DrizzleUserRepository', () => {
  let testDb: TestDb
  let repository: DrizzleUserRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleUserRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findById', () => {
    it('保存したユーザーをIDで取得できる', async () => {
      const user = new User('11111111-1111-1111-1111-111111111111', '山田太郎', 'yamada@example.com', null, null, new Date())

      await repository.save(user)
      const found = await repository.findById(user.id)

      expect(found).toEqual(user)
    })

    it('存在しないIDの場合はnullを返す', async () => {
      const found = await repository.findById('99999999-9999-9999-9999-999999999999')

      expect(found).toBeNull()
    })
  })

  describe('findByEmail', () => {
    it('メールアドレスでユーザーを取得できる', async () => {
      await createTestUser(testDb.db, { name: '鈴木花子', email: 'suzuki@example.com' })

      const found = await repository.findByEmail('suzuki@example.com')

      expect(found?.name).toBe('鈴木花子')
    })

    it('存在しないメールアドレスの場合はnullを返す', async () => {
      const found = await repository.findByEmail('not-exist@example.com')

      expect(found).toBeNull()
    })
  })

  describe('findByName', () => {
    it('部分一致・大文字小文字を区別せずユーザーを検索できる', async () => {
      await createTestUser(testDb.db, { name: 'Taro Yamada' })
      await createTestUser(testDb.db, { name: '別の人' })

      const found = await repository.findByName('taro')

      expect(found).toHaveLength(1)
      expect(found[0].name).toBe('Taro Yamada')
    })
  })

  describe('updateProfile', () => {
    it('プロフィールを更新できる', async () => {
      const user = await createTestUser(testDb.db, { name: '更新前' })

      await repository.updateProfile(user.id, { name: '更新後', birthdate: '1990-01-01', snsUrl: 'https://example.com' })
      const found = await repository.findById(user.id)

      expect(found?.name).toBe('更新後')
      expect(found?.birthdate).toBe('1990-01-01')
      expect(found?.snsUrl).toBe('https://example.com')
    })
  })
})
