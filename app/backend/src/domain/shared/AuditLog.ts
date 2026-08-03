export class AuditLog {
  constructor(
    readonly id: string,
    readonly userId: string | null,
    readonly action: string,
    readonly result: 'success' | 'failure',
    readonly ipAddress: string,
    readonly userAgent: string,
    readonly metadata: Record<string, unknown> | null,
    readonly createdAt: Date,
  ) {}
}
