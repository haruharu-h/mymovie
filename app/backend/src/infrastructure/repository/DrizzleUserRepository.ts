import { eq, ilike } from 'drizzle-orm'
import type { DbClient } from '../db/client.js'
import { users } from '../db/schema.js'
import { User } from '../../domain/user/User.js'
import type { IUserRepository, UpdateProfileData } from '../../domain/user/IUserRepository.js'

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: DbClient) {}

  async save(user: User): Promise<void> {
    await this.db.insert(users).values({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    })
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.id, id),
    })

    if (!row) return null

    return new User(row.id, row.name, row.email ?? null, row.birthdate ?? null, row.snsUrl ?? null, row.createdAt)
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.db.query.users.findFirst({
      where: eq(users.email, email),
    })

    if (!row) return null

    return new User(row.id, row.name, row.email ?? null, row.birthdate ?? null, row.snsUrl ?? null, row.createdAt)
  }

  async findByName(name: string): Promise<User[]> {
    const rows = await this.db.query.users.findMany({
      where: ilike(users.name, `%${name}%`),
    })

    return rows.map(row => new User(row.id, row.name, row.email ?? null, row.birthdate ?? null, row.snsUrl ?? null, row.createdAt))
  }

  async updateProfile(userId: string, data: UpdateProfileData): Promise<void> {
    await this.db.update(users)
      .set({ name: data.name, birthdate: data.birthdate, snsUrl: data.snsUrl })
      .where(eq(users.id, userId))
  }
}
