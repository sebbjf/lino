import { buildApp } from './app.ts'

const app = buildApp({ logger: true })

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => app.close().then(() => process.exit(0)))
}

await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' })
