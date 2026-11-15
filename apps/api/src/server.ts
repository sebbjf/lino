import { buildApp } from './app.ts'
import { pgBoards } from './boards.ts'

// without a database the API still reads links; sharing answers 503
const boards = process.env.DATABASE_URL ? await pgBoards(process.env.DATABASE_URL) : undefined
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
