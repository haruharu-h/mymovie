import {
  pgTable,
  uuid,
  text,
  integer,
  real,
  timestamp,
  date,
  uniqueIndex,
  index,
  primaryKey,
  check,
  jsonb,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email'),
  birthdate: date('birthdate'),
  snsUrl: text('sns_url'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const identities = pgTable(
  'identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    provider: text('provider').notNull(),
    providerId: text('provider_id').notNull(),
    passwordHash: text('password_hash'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('identities_provider_provider_id_idx').on(t.provider, t.providerId),
    index('idx_identities_user_id').on(t.userId),
  ]
)

export const movies = pgTable('movies', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  posterPath: text('poster_path').notNull(),
  releaseDate: date('release_date').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    movieId: text('movie_id')
      .notNull()
      .references(() => movies.id),
    score: real('score').notNull(),
    registeredAt: timestamp('registered_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('reviews_user_id_movie_id_idx').on(t.userId, t.movieId),
    index('idx_reviews_user_id').on(t.userId),
    index('idx_reviews_movie_id').on(t.movieId),
    check('score_range', sql`${t.score} >= 0 AND ${t.score} <= 5`),
  ]
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id'),  // null = 未ログインユーザー
    action: text('action').notNull(),
    result: text('result').notNull(),
    ipAddress: text('ip_address').notNull(),
    userAgent: text('user_agent').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_audit_logs_user_id').on(t.userId),
    index('idx_audit_logs_action').on(t.action),
    index('idx_audit_logs_created_at').on(t.createdAt),
  ]
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('idx_sessions_user_id').on(t.userId),
  ]
)

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    purpose: text('purpose').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    consumedAt: timestamp('consumed_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('verification_tokens_token_hash_idx').on(t.tokenHash),
    // 同一ユーザー・同一用途で未使用のトークンは常に1件だけ、という業務ルールをDB制約でも強制する
    // （アプリ側は再発行時に既存の未使用トークンを明示的に無効化する。詳細: docs/decisions.md）
    uniqueIndex('verification_tokens_user_id_purpose_active_idx')
      .on(t.userId, t.purpose)
      .where(sql`${t.consumedAt} IS NULL`),
    index('idx_verification_tokens_user_id').on(t.userId),
  ]
)

export const follows = pgTable(
  'follows',
  {
    followerId: uuid('follower_id')
      .notNull()
      .references(() => users.id),
    followeeId: uuid('followee_id')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followeeId] }),
    index('idx_follows_follower_id').on(t.followerId),
    index('idx_follows_followee_id').on(t.followeeId),
  ]
)
