import { eq } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { sessions } from '../db/schema.js'
import { Session } from '../../domain/auth/Session.js'
import type { ISessionRepository } from '../../domain/auth/ISessionRepository.js'

export class DrizzleSessionRepository implements ISessionRepository {
  constructor(private readonly db: DbClient) {}

  async save(session: Session): Promise<void> {
    await this.db.insert(sessions).values({
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    })
  }

  async findByRefreshTokenHash(hash: string): Promise<Session | null> {
    const row = await this.db.query.sessions.findFirst({
      where: eq(sessions.refreshTokenHash, hash),
    })

    if (!row) return null

    return new Session(
      row.id,
      row.userId,
      row.refreshTokenHash,
      row.expiresAt,
      row.createdAt,
    )
  }

  async updateRefreshTokenHash(id: string, hash: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ refreshTokenHash: hash })
      .where(eq(sessions.id, id))
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id))
  }

  async deleteAllByUserId(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId))
  }
}
