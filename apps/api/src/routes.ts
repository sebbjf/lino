import Fastify, { type FastifyServerOptions } from 'fastify'
import { readLink } from './extract.ts'
import { StoreFullError, type BoardStore } from './boards.ts'
import { BlockedError, type Fetcher } from './fetch.ts'

type Opts = FastifyServerOptions & { fetcher?: Fetcher; readsPerMinute?: number; sharesPerHour?: number; boards?: BoardStore }

// Vercel functions refuse request bodies over 4.5 MB, so stay under it.
export const MAX_BOARD_BYTES = 4 * 1024 * 1024
const SHARE_DAYS = 90

// What a shared board may contain. Strict on purpose: another person's browser renders it.
const dataImage = { type: 'string', pattern: '^data:image/(png|jpeg|webp|gif);base64,' }
const hex = { type: 'string', pattern: '^#[0-9a-fA-F]{3,8}$' }
const strings = (maxItems: number, maxLength: number) => ({ type: 'array', maxItems, items: { type: 'string', maxLength } })
const requires = (type: string, fields: string[]) => ({ if: { properties: { type: { const: type } } }, then: { required: fields } })
export const elementSchema = {
  type: 'object',
  required: ['id', 'type', 'x', 'y', 'w', 'h', 'rotation'],
  additionalProperties: false,
  properties: {
    id: { type: 'string', maxLength: 64 },
    type: { enum: ['image', 'note', 'color', 'link'] },
    x: { type: 'number', minimum: -1e6, maximum: 1e6 },
    y: { type: 'number', minimum: -1e6, maximum: 1e6 },
    w: { type: 'number', minimum: 1, maximum: 10_000 },
    h: { type: 'number', minimum: 1, maximum: 10_000 },
    rotation: { type: 'number' },
    src: dataImage,
    text: { type: 'string', maxLength: 10_000 },
    hex,
    url: { type: 'string', maxLength: 2048, pattern: '^https?://[^\s/?#]+' },
    title: { type: ['string', 'null'], maxLength: 500 },
    image: { anyOf: [dataImage, { type: 'null' }] },
    fonts: strings(20, 100),
    colors: { type: 'array', maxItems: 20, items: hex },
    status: { enum: ['ok', 'error'] },
    missing: strings(10, 20),
    error: { type: 'string', maxLength: 300 },
    corner: { enum: ['square', 'soft', 'round'] },
    shadow: { type: 'boolean' },
    deco: { enum: ['tape', 'pin'] },
    opacity: { type: 'number', minimum: 0.2, maximum: 1 },
    bg: hex,
    color: hex,
    size: { enum: ['sm', 'md', 'lg', 'xl'] },
    align: { enum: ['left', 'center', 'right'] },
    bold: { type: 'boolean' },
    italic: { type: 'boolean' },
    font: { enum: ['sans', 'serif'] },
    family: { type: 'string', pattern: '^[A-Za-z0-9 _-]{1,60}$' },
    filter: { enum: ['mono', 'duotone'] },
    duo: { type: 'array', minItems: 2, maxItems: 2, items: hex },
  },
  allOf: [
    requires('image', ['src']),
    requires('note', ['text']),
    requires('color', ['hex']),
    requires('link', ['url', 'title', 'image', 'fonts', 'colors', 'status', 'missing']),
  ],
}
const boardSchema = {
  type: 'object',
  required: ['elements'],
  additionalProperties: false,
  properties: {
    elements: { type: 'array', minItems: 1, maxItems: 300, items: elementSchema },
    colorMeta: {
      type: 'object',
      maxProperties: 300,
      propertyNames: { pattern: hex.pattern },
      additionalProperties: {
        type: 'object',
        additionalProperties: false,
        properties: { name: { type: 'string', maxLength: 60 }, pinned: { type: 'boolean' }, hidden: { type: 'boolean' }, order: { type: 'number' } },
      },
    },
    board: {
      type: 'object',
      additionalProperties: false,
      properties: { bg: hex, pattern: { enum: ['dots', 'grid', 'plain'] }, messy: { type: 'boolean' } },
    },
  },
}

// ponytail: in-memory fixed window per IP, one process only; move to Redis or the proxy if the API scales out.
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (ip: string) => {
    const now = Date.now()
    const h = hits.get(ip)
    if (!h || h.reset < now) {
      // drop finished windows first, so filling the map does not reset everyone's count
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
      if (hits.size > 10_000) hits.clear()
      hits.set(ip, { n: 1, reset: now + windowMs })
      return false
    }
    return ++h.n > max
  }
}

export function buildApp({ fetcher, readsPerMinute = 30, sharesPerHour = 20, boards, ...opts }: Opts = {}) {
  // base64 images are counted after JSON parsing too; this is the transport cap
  const app = Fastify({ bodyLimit: MAX_BOARD_BYTES + 256 * 1024, ...opts })

  // 5xx messages can carry database details (host, user); log them, answer something generic
  app.setErrorHandler((err: Error & { statusCode?: number }, req, reply) => {
    const status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500
    if (status < 500) return reply.code(status).send({ error: err.message })
    req.log.error(err)
    return reply.code(status).send({ error: 'Something went wrong. Try again later.' })
  })
  app.addHook('onSend', async (_req, reply) => void reply.header('x-content-type-options', 'nosniff'))

  // The web app lives on another origin in production.
  // browsers send the origin without a trailing slash; tolerate one pasted into the setting
  const origin = process.env.CORS_ORIGIN?.replace(/\/+$/, '')
  if (origin) {
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

  app.get('/health', { schema: { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } } }, () => ({
    ok: true,
  }))

  const limited = rateLimit(readsPerMinute, 60_000)
  const shareLimited = rateLimit(sharesPerHour, 3_600_000)

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
        // the pasted address is not logged: the privacy page says the server does not keep it
        req.log.info({ err: e }, 'read failed')
        const timeout = (e as Error).name === 'TimeoutError' || (e as Error).name === 'AbortError'
        return reply.code(502).send({ error: timeout ? 'The page took too long to answer.' : 'Could not read that page.' })
      }
    },
  )

  app.post<{ Body: unknown }>('/boards', { schema: { body: boardSchema } }, async (req, reply) => {
    if (!boards) return reply.code(503).send({ error: 'Sharing is not available right now.' })
    const bytes = Buffer.byteLength(JSON.stringify(req.body))
    if (bytes > MAX_BOARD_BYTES) return reply.code(413).send({ error: `This board is too large to share (limit ${MAX_BOARD_BYTES / 1024 / 1024} MB).` })
    if (shareLimited(req.ip)) return reply.code(429).send({ error: 'Too many shares. Try again later.' })
    const expiresAt = new Date(Date.now() + SHARE_DAYS * 86_400_000)
    const id = await boards.create(req.body, bytes, expiresAt).catch((e) => {
      if (e instanceof StoreFullError) return null
      throw e
    })
    if (!id) return reply.code(503).send({ error: 'Sharing is full right now. Try again later.' })
    return reply.code(201).send({ id, expiresAt: expiresAt.toISOString() })
  })

  app.get<{ Params: { id: string } }>(
    '/boards/:id',
    { schema: { params: { type: 'object', properties: { id: { type: 'string', pattern: '^[A-Za-z0-9_-]{12}$' } } } } },
    async (req, reply) => {
      if (!boards) return reply.code(503).send({ error: 'Sharing is not available right now.' })
      const data = await boards.get(req.params.id)
      if (!data) return reply.code(404).send({ error: 'This board does not exist or has expired.' })
      // snapshots never change
      return reply.header('cache-control', 'public, max-age=86400, immutable').send(data)
    },
  )

  return app
}
