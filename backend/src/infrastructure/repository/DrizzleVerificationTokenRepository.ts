import { and, eq, isNull } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { verificationTokens } from '../db/schema.js'
import { VerificationToken } from '../../domain/auth/VerificationToken.js'
import type { VerificationTokenPurpose } from '../../domain/auth/VerificationToken.js'
import type { IVerificationTokenRepository } from '../../domain/auth/IVerificationTokenRepository.js'

export class DrizzleVerificationTokenRepository implements IVerificationTokenRepository {
  constructor(private readonly db: DbClient) {}

  async save(token: VerificationToken): Promise<void> {
    await this.db.insert(verificationTokens).values({
      id: token.id,
      userId: token.userId,
      purpose: token.purpose,
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
      consumedAt: token.consumedAt,
      createdAt: token.createdAt,
    })
  }

  async findByTokenHash(hash: string): Promise<VerificationToken | null> {
    const row = await this.db.query.verificationTokens.findFirst({
      where: eq(verificationTokens.tokenHash, hash),
    })

    if (!row) return null

    return new VerificationToken(
      row.id,
      row.userId,
      row.purpose as VerificationTokenPurpose,
      row.tokenHash,
      row.expiresAt,
      row.consumedAt,
      row.createdAt,
    )
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.db
      .update(verificationTokens)
      .set({ consumedAt })
      .where(eq(verificationTokens.id, id))
  }

  async deleteActiveByUserIdAndPurpose(
    userId: string,
    purpose: VerificationTokenPurpose,
  ): Promise<void> {
    await this.db
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.userId, userId),
          eq(verificationTokens.purpose, purpose),
          isNull(verificationTokens.consumedAt),
        ),
      )
  }
}
