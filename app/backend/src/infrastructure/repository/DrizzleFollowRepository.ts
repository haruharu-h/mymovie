import { eq, and } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { follows, users } from '../db/schema.js'
import { Follow } from '../../domain/follow/Follow.js'
import { User } from '../../domain/user/User.js'
import type { IFollowRepository } from '../../domain/follow/IFollowRepository.js'

export class DrizzleFollowRepository implements IFollowRepository {
  constructor(private readonly db: DbClient) {}

  async save(follow: Follow): Promise<void> {
    await this.db.insert(follows).values({
      followerId: follow.followerId,
      followeeId: follow.followeeId,
    }).onConflictDoNothing()
  }

  async delete(followerId: string, followeeId: string): Promise<void> {
    await this.db.delete(follows).where(
      and(
        eq(follows.followerId, followerId),
        eq(follows.followeeId, followeeId),
      )
    )
  }

  async findFolloweesByFollowerId(followerId: string): Promise<User[]> {
    const rows = await this.db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(follows.followeeId, users.id))
      .where(eq(follows.followerId, followerId))

    return rows.map(row => new User(row.user.id, row.user.name, row.user.email ?? null, row.user.birthdate ?? null, row.user.snsUrl ?? null, row.user.createdAt))
  }
}
