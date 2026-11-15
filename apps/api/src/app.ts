import Fastify, { type FastifyServerOptions } from 'fastify'
import { readLink } from './extract.ts'
import { BlockedError, type Fetcher } from './fetch.ts'

type Opts = FastifyServerOptions & { fetcher?: Fetcher; readsPerMinute?: number }

export function buildApp({ fetcher, readsPerMinute = 30, ...opts }: Opts = {}) {
  const app = Fastify(opts)

  // The web app lives on another origin in production.
  const origin = process.env.CORS_ORIGIN
  if (origin) app.addHook('onSend', async (_req, reply) => void reply.header('access-control-allow-origin', origin))

  app.get('/health', { schema: { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } } }, () => ({
    ok: true,
  }))

  // ponytail: in-memory fixed window per IP, one process only; move to Redis or the proxy if the API scales out.
  const hits = new Map<string, { n: number; reset: number }>()
  const limited = (ip: string) => {
    const now = Date.now()
    const h = hits.get(ip)
    if (!h || h.reset < now) {
      if (hits.size > 10_000) hits.clear()
      hits.set(ip, { n: 1, reset: now + 60_000 })
      return false
    }
    return ++h.n > readsPerMinute
  }

  app.get<{ Querystring: { url: string } }>(
    '/read',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string', minLength: 1, maxLength: 2048 } },
        },
      },
    },
    async (req, reply) => {
      if (limited(req.ip)) return reply.code(429).send({ error: 'Too many links at once. Try again in a minute.' })
      try {
        const data = await readLink(req.query.url, fetcher)
        // ponytail: cache is left to the browser/CDN; add a server cache if the same URLs get read a lot.
        return reply.header('cache-control', 'public, max-age=3600').send(data)
      } catch (e) {
        if (e instanceof BlockedError) return reply.code(400).send({ error: e.message })
        req.log.info({ err: e, url: req.query.url }, 'read failed')
        const timeout = (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError'
        return reply.code(502).send({ error: timeout ? 'The page took too long to answer.' : 'Could not read that page.' })
      }
    },
  )

  return app
}
