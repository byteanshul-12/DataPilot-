// PostgreSQL schema definitions using Drizzle ORM for Better Auth and DataPilot.
import { pgTable, uuid, text, timestamp, jsonb, integer, boolean } from 'drizzle-orm/pg-core';

// Better Auth user table
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Better Auth session table
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// Better Auth account table for OAuth providers and email password
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Better Auth verification table
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Anonymous Guest Sessions
export const guestSessions = pgTable('guest_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: text('guest_id').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Guest-Specific Temporary Data
export const guestData = pgTable('guest_data', {
  id: uuid('id').defaultRandom().primaryKey(),
  guestId: text('guest_id').notNull().references(() => guestSessions.guestId, { onDelete: 'cascade' }),
  dataType: text('data_type').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Data collection task records
export const collectionTasks = pgTable('collection_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('pending'),
  resultCount: integer('result_count').default(0),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  guestId: text('guest_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Extracted collection data results
export const collectionResults = pgTable('collection_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => collectionTasks.id, { onDelete: 'cascade' }),
  sourceUrl: text('source_url'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
