import { eq, and } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { identities } from '../db/schema.js'
import { Identity } from '../../domain/auth/Identity.js'
import type { IIdentityRepository } from '../../domain/auth/IIdentityRepository.js'

export class DrizzleIdentityRepository implements IIdentityRepository {
  constructor(private readonly db: DbClient) {}

  async save(identity: Identity): Promise<void> {
    await this.db.insert(identities).values({
      id: identity.id,
      userId: identity.userId,
      provider: identity.provider,
      providerId: identity.providerId,
      passwordHash: identity.passwordHash,
      createdAt: identity.createdAt,
    })
  }

  async findByProviderAndProviderId(
    provider: 'email' | 'google' | 'github',
    providerId: string,
  ): Promise<Identity | null> {
    const row = await this.db.query.identities.findFirst({
      where: and(
        eq(identities.provider, provider),
        eq(identities.providerId, providerId),
      ),
    })

    if (!row) return null

    return new Identity(
      row.id,
      row.userId,
      row.provider as 'email' | 'google' | 'github',
      row.providerId,
      row.passwordHash,
      row.createdAt,
    )
  }
}
