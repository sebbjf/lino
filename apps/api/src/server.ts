import { buildApp } from './app.ts'
import { migrateDb, pgBoards } from './boards.ts'

// Locally migrate on start; on Vercel (VERCEL is set) migrations ran at build. Without a database the API still reads links; sharing answers 503.
const url = process.env.DATABASE_URL
if (url && !process.env.VERCEL) await migrateDb(url)
const boards = url ? pgBoards(url) : undefined
const app = buildApp({ logger: true, trustProxy: process.env.TRUST_PROXY === '1', boards })
if (!boards) app.log.warn('DATABASE_URL is not set: sharing is off')

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () =>
    app
      .close()
      .then(() => boards?.close())
      .then(() => process.exit(0)),
  )
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
