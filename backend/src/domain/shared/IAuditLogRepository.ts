import type { AuditLog } from './AuditLog.js'

export interface IAuditLogRepository {
  save(auditLog: AuditLog): Promise<void>
}
