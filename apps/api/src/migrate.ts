import { migrateDb } from './boards.ts'

// Run at deploy (vercel-build) so request handlers never migrate. Neon's direct URL avoids the pooler for DDL.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
if (!url) {
  console.log('DATABASE_URL is not set: skipping migrations')
} else {
  await migrateDb(url)
  console.log('migrations applied')
}
