// PostgreSQL schema definitions using Drizzle ORM.
import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

// Authenticated Application Users (mapped to Clerk User ID)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email'),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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

export const collectionTasks = pgTable('collection_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('pending'),
  resultCount: integer('result_count').default(0),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  guestId: text('guest_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const collectionResults = pgTable('collection_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => collectionTasks.id, { onDelete: 'cascade' }),
  sourceUrl: text('source_url'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
