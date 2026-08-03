import type { DbClient } from '../db/client.js'
import { auditLogs } from '../db/schema.js'
import { AuditLog } from '../../domain/shared/AuditLog.js'
import type { IAuditLogRepository } from '../../domain/shared/IAuditLogRepository.js'

export class DrizzleAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly db: DbClient) {}

  async save(auditLog: AuditLog): Promise<void> {
    await this.db.insert(auditLogs).values({
      id: auditLog.id,
      userId: auditLog.userId,
      action: auditLog.action,
      result: auditLog.result,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
  }
}
