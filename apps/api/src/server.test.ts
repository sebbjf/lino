import assert from 'node:assert/strict'
import http from 'node:http'
import { test } from 'node:test'

// Mimics how Vercel's Node runtime loads the entry: http.Server#listen is replaced by a stub that captures
// the server and never calls back, the module import must finish, then the captured server is started.
test('server.ts loads and serves under the Vercel runtime', async () => {
  delete process.env.DATABASE_URL
  let server: http.Server | undefined
  const original = http.Server.prototype.listen
  http.Server.prototype.listen = function (this: http.Server) {
    server = this
    return this
  } as typeof original
  try {
    const loaded = import('./server.ts')
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('module never finished loading')), 2000))
    await Promise.race([loaded, timeout])
    // Fastify calls listen after its plugins are ready; Vercel waits up to 1 s for it
    for (let i = 0; i < 20 && !server; i++) await new Promise((r) => setTimeout(r, 50))
  } finally {
    http.Server.prototype.listen = original
  }
  assert.ok(server, 'no http.Server was captured')
  await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r))
  const { port } = server.address() as { port: number }
  const res = await fetch(`http://127.0.0.1:${port}/health`)
  assert.deepEqual(await res.json(), { ok: true })
  await new Promise((r) => server!.close(r))
})
