export class Session {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly refreshTokenHash: string,
    readonly expiresAt: Date,
    readonly createdAt: Date,
  ) {}

  isExpired(): boolean {
    return new Date() > this.expiresAt
  }
}
