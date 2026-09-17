import type { VerificationToken, VerificationTokenPurpose } from './VerificationToken.js'

export interface IVerificationTokenRepository {
  save(token: VerificationToken): Promise<void>
  findByTokenHash(hash: string): Promise<VerificationToken | null>
  markConsumed(id: string, consumedAt: Date): Promise<void>
  deleteActiveByUserIdAndPurpose(userId: string, purpose: VerificationTokenPurpose): Promise<void>
}
