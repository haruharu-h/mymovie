import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { sql } from 'drizzle-orm'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDbClient, DbClient } from '../../src/infrastructure/db/client.js'
import { users, movies } from '../../src/infrastructure/db/schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export type TestDb = {
  db: DbClient
  container: StartedPostgreSqlContainer
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start()
  const db = createDbClient(container.getConnectionUri())
  await migrate(db, {
    migrationsFolder: path.join(__dirname, '../../src/infrastructure/db/migrations'),
  })
  return { db, container }
}

export async function stopTestDb({ container }: TestDb): Promise<void> {
  await container.stop()
}

const ALL_TABLES = ['follows', 'sessions', 'audit_logs', 'reviews', 'movies', 'identities', 'users']

export async function truncateAll(db: DbClient): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE TABLE ${ALL_TABLES.join(', ')} RESTART IDENTITY CASCADE`))
}

// FK制約を持つテーブル（identities/reviews/sessions/follows）のテスト用フィクスチャ
export async function createTestUser(
  db: DbClient,
  overrides: Partial<{ name: string; email: string | null }> = {},
) {
  const [user] = await db.insert(users).values({
    name: overrides.name ?? 'テストユーザー',
    email: overrides.email ?? null,
    createdAt: new Date(),
  }).returning()
  return user
}

export async function createTestMovie(
  db: DbClient,
  overrides: Partial<{ id: string; title: string }> = {},
) {
  const [movie] = await db.insert(movies).values({
    id: overrides.id ?? crypto.randomUUID(),
    title: overrides.title ?? 'テスト映画',
    posterPath: '/poster.jpg',
    releaseDate: '2024-01-01',
    updatedAt: new Date(),
  }).returning()
  return movie
}
