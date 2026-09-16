import { describe, it, expect, beforeAll, afterAll, afterEach } from '@jest/globals'
import { sql } from 'drizzle-orm'
import { startTestDb, stopTestDb, truncateAll, createTestUser, TestDb } from '../../../jest/integration/testDb.js'
import { auditLogs } from '../db/schema.js'
import { DrizzleAuditLogRepository } from './DrizzleAuditLogRepository.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'

describe('DrizzleAuditLogRepository', () => {
  let testDb: TestDb
  let repository: DrizzleAuditLogRepository

  beforeAll(async () => {
    testDb = await startTestDb()
    repository = new DrizzleAuditLogRepository(testDb.db)
  }, 60_000)

  afterEach(async () => {
    await truncateAll(testDb.db)
  })

  afterAll(async () => {
    await stopTestDb(testDb)
  })

  describe('save', () => {
    it('監査ログを保存できる', async () => {
      const user = await createTestUser(testDb.db)
      const auditLog = new AuditLog(
        '55555555-5555-5555-5555-555555555555',
        user.id,
        'auth.login',
        'success',
        '127.0.0.1',
        'jest-test-agent',
        { via: 'email' },
        new Date(),
      )

      await repository.save(auditLog)

      const [row] = await testDb.db.select().from(auditLogs).where(sql`${auditLogs.id} = ${auditLog.id}`)
      expect(row.action).toBe('auth.login')
      expect(row.result).toBe('success')
      expect(row.metadata).toEqual({ via: 'email' })
    })

    it('未ログインユーザー（userId: null）の監査ログも保存できる', async () => {
      const auditLog = new AuditLog(
        '66666666-6666-6666-6666-666666666666',
        null,
        'auth.login',
        'failure',
        '127.0.0.1',
        'jest-test-agent',
        null,
        new Date(),
      )

      await repository.save(auditLog)

      const [row] = await testDb.db.select().from(auditLogs).where(sql`${auditLogs.id} = ${auditLog.id}`)
      expect(row.userId).toBeNull()
    })
  })
})
