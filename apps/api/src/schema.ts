import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** Shared boards: a fixed, anonymous snapshot. Images are inline data URLs inside `data`. */
export const boards = pgTable('boards', {
  id: text('id').primaryKey(),
  data: jsonb('data').notNull(),
  bytes: integer('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
