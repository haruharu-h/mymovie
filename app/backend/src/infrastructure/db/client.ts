import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type DbClient = ReturnType<typeof createDbClient>

export function createDbClient(databaseUrl: string) {
  const sql = postgres(databaseUrl)
  return drizzle(sql, { schema })
}
