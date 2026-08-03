import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { DrizzleFollowRepository } from './DrizzleFollowRepository.js'
import { Follow } from '../../domain/follow/Follow.js'

describe('DrizzleFollowRepository', () => {
  let testDb: TestDb
  let repository: DrizzleFollowRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleFollowRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save / findFolloweesByFollowerId', () => {
    it('フォローしたユーザー一覧を取得できる', async () => {
      const follower = await createTestUser(testDb.db, { name: 'フォロワー' })
      const followeeA = await createTestUser(testDb.db, { name: 'フォロー先A' })
      const followeeB = await createTestUser(testDb.db, { name: 'フォロー先B' })

      await repository.save(new Follow(follower.id, followeeA.id, new Date()))
      await repository.save(new Follow(follower.id, followeeB.id, new Date()))

      const found = await repository.findFolloweesByFollowerId(follower.id)

      expect(found.map(u => u.name).sort()).toEqual(['フォロー先A', 'フォロー先B'])
    })

    it('誰もフォローしていない場合は空配列を返す', async () => {
      const follower = await createTestUser(testDb.db)

      const found = await repository.findFolloweesByFollowerId(follower.id)

      expect(found).toEqual([])
    })

    it('同じ組み合わせを重複フォローしても増えない', async () => {
      const follower = await createTestUser(testDb.db)
      const followee = await createTestUser(testDb.db)

      await repository.save(new Follow(follower.id, followee.id, new Date()))
      await repository.save(new Follow(follower.id, followee.id, new Date()))

      expect(await repository.findFolloweesByFollowerId(follower.id)).toHaveLength(1)
    })
  })

  describe('delete', () => {
    it('フォローを解除できる', async () => {
      const follower = await createTestUser(testDb.db)
      const followee = await createTestUser(testDb.db)
      await repository.save(new Follow(follower.id, followee.id, new Date()))

      await repository.delete(follower.id, followee.id)

      expect(await repository.findFolloweesByFollowerId(follower.id)).toEqual([])
    })
  })
})
