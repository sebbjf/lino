import Fastify, { type FastifyServerOptions } from 'fastify'

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts)

  app.get('/health', { schema: { response: { 200: { type: 'object', properties: { ok: { type: 'boolean' } } } } } }, () => ({
    ok: true,
  }))

  return app
}
