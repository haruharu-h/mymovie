import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { instrumentDrizzleClient } from '@kubiks/otel-drizzle'
import * as schema from './schema.js'

export type DbClient = ReturnType<typeof createDbClient>

export function createDbClient(databaseUrl: string) {
  const sql = postgres(databaseUrl)
  const db = drizzle(sql, { schema })
  instrumentDrizzleClient(db, { dbSystem: 'postgresql' })
  return db
}
