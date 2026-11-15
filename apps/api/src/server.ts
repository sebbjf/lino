// Vercel's Fastify detection needs the entry file itself to import fastify (the app is built in routes.ts).
import 'fastify'
import { buildApp } from './routes.ts'
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

// Not awaited: Vercel's runtime intercepts http.Server#listen to capture the server and never calls back,
// so awaiting here would keep this module from finishing to load and every request would hang.
app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' }).catch((err) => {
  app.log.error(err)
  process.exit(1)
})
