import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { readLink } from './extract.ts'
import { StoreFullError, type BoardStore } from './boards.ts'
import { boardSchema } from './elementSchema.ts'
import { rateLimit } from './rateLimit.ts'
import { BlockedError, type Fetcher } from './fetch.ts'

type Options = FastifyServerOptions & {
  fetcher?: Fetcher
  readsPerMinute?: number
  sharesPerHour?: number
  boards?: BoardStore
}

// Vercel functions refuse request bodies over 4.5 MB, so stay under it.
export const MAX_BOARD_BYTES = 4 * 1024 * 1024
const SHARE_DAYS = 90
const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

export function buildApp({ fetcher, readsPerMinute = 30, sharesPerHour = 20, boards, ...options }: Options = {}) {
  // base64 images are counted after JSON parsing too; this is the transport cap
  const app = Fastify({ bodyLimit: MAX_BOARD_BYTES + 256 * 1024, ...options })

  addErrorHandler(app)
  addSecurityHeaders(app)
  addCors(app, process.env.CORS_ORIGIN)
  addHealthRoute(app)
  addReadRoute(app, fetcher, rateLimit(readsPerMinute, MINUTE_MS))
  addBoardRoutes(app, boards, rateLimit(sharesPerHour, HOUR_MS))

  return app
}

function addErrorHandler(app: FastifyInstance) {
  // 5xx messages can carry database details (host, user); log them, answer something generic
  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
    if (status < 500) return reply.code(status).send({ error: err.message })
    req.log.error(err)
    return reply.code(status).send({ error: 'Something went wrong. Try again later.' })
  })
}

function addSecurityHeaders(app: FastifyInstance) {
  app.addHook('onSend', async (_req, reply) => void reply.header('x-content-type-options', 'nosniff'))
}

/** The web app lives on another origin in production. */
function addCors(app: FastifyInstance, configuredOrigin: string | undefined) {
  // browsers send the origin without a trailing slash; tolerate one pasted into the setting
  const origin = configuredOrigin?.replace(/\/+$/, '')
  if (!origin) return

  app.addHook('onSend', async (_req, reply) => void reply.header('access-control-allow-origin', origin))
  // POST with a JSON body sends a preflight first
  app.options('*', (_req, reply) =>
    reply
      .code(204)
      .header('access-control-allow-methods', 'GET, POST')
      .header('access-control-allow-headers', 'content-type')
      .header('access-control-max-age', '86400')
      .send(),
  )
}

function addHealthRoute(app: FastifyInstance) {
  const schema = { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } }
  app.get('/health', { schema }, () => ({ ok: true }))
}

function addReadRoute(app: FastifyInstance, fetcher: Fetcher | undefined, isLimited: (ip: string) => boolean) {
  const schema = {
    querystring: {
      type: 'object',
      required: ['url'],
      properties: { url: { type: 'string', minLength: 1, maxLength: 2048 } },
    },
  }

  app.get<{ Querystring: { url: string } }>('/read', { schema }, async (req, reply) => {
    if (isLimited(req.ip)) return reply.code(429).send({ error: 'Too many links at once. Try again in a minute.' })
    try {
      const data = await readLink(req.query.url, fetcher)
      // ponytail: cache is left to the browser/CDN; add a server cache if the same URLs get read a lot.
      return reply.header('cache-control', 'public, max-age=3600').send(data)
    } catch (e) {
      if (e instanceof BlockedError) return reply.code(400).send({ error: e.message })
      // the pasted address is not logged: the privacy page says the server does not keep it
      req.log.info({ err: e }, 'read failed')
      const message = isTimeout(e) ? 'The page took too long to answer.' : 'Could not read that page.'
      return reply.code(502).send({ error: message })
    }
  })
}

const isTimeout = (e: unknown) => e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')

function addBoardRoutes(app: FastifyInstance, boards: BoardStore | undefined, isLimited: (ip: string) => boolean) {
  const sharingOff = { error: 'Sharing is not available right now.' }

  app.post<{ Body: unknown }>('/boards', { schema: { body: boardSchema } }, async (req, reply) => {
    if (!boards) return reply.code(503).send(sharingOff)

    const bytes = Buffer.byteLength(JSON.stringify(req.body))
    if (bytes > MAX_BOARD_BYTES) {
      const limitMb = MAX_BOARD_BYTES / 1024 / 1024
      return reply.code(413).send({ error: `This board is too large to share (limit ${limitMb} MB).` })
    }
    if (isLimited(req.ip)) return reply.code(429).send({ error: 'Too many shares. Try again later.' })

    const expiresAt = new Date(Date.now() + SHARE_DAYS * DAY_MS)
    try {
      const id = await boards.create(req.body, bytes, expiresAt)
      return reply.code(201).send({ id, expiresAt: expiresAt.toISOString() })
    } catch (e) {
      if (e instanceof StoreFullError) return reply.code(503).send({ error: 'Sharing is full right now. Try again later.' })
      throw e
    }
  })

  const idSchema = { params: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{12}$' } } } }

  app.get<{ Params: { id: string } }>('/boards/:id', { schema: idSchema }, async (req, reply) => {
    if (!boards) return reply.code(503).send(sharingOff)

    const board = await boards.get(req.params.id)
    if (!board) return reply.code(404).send({ error: 'This board does not exist or has expired.' })
    // snapshots never change
    return reply.header('cache-control', 'public, max-age=86400, immutable').send(board)
  })
}
