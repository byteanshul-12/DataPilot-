// PostgreSQL schema definitions using Drizzle ORM.
import { pgTable, uuid, text, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';

export const collectionTasks = pgTable('collection_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  prompt: text('prompt').notNull(),
  status: text('status').notNull().default('pending'),
  resultCount: integer('result_count').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const collectionResults = pgTable('collection_results', {
  id: uuid('id').defaultRandom().primaryKey(),
  taskId: uuid('task_id').references(() => collectionTasks.id),
  sourceUrl: text('source_url'),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
