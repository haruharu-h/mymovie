export type VerificationTokenPurpose = 'email_confirmation' | 'password_reset'

export class VerificationToken {
  constructor(
    readonly id: string,
    readonly userId: string,
    readonly purpose: VerificationTokenPurpose,
    readonly tokenHash: string,
    readonly expiresAt: Date,
    readonly consumedAt: Date | null,
    readonly createdAt: Date,
  ) {}

  isExpired(): boolean {
    return new Date() > this.expiresAt
  }

  isConsumed(): boolean {
    return this.consumedAt !== null
  }
}
