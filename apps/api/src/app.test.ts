import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from './app.ts'

test('GET /health', async () => {
  const app = buildApp()
  const res = await app.inject({ method: 'GET', url: '/health' })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json(), { ok: true })
})

test('unknown route is 404', async () => {
  const res = await buildApp().inject({ method: 'GET', url: '/nope' })
  assert.equal(res.statusCode, 404)
})

test('CORS preflight when CORS_ORIGIN is set', async () => {
  process.env.CORS_ORIGIN = 'https://lino.test'
  try {
    const res = await buildApp().inject({ method: 'OPTIONS', url: '/boards' })
    assert.equal(res.statusCode, 204)
    assert.equal(res.headers['access-control-allow-origin'], 'https://lino.test')
    assert.match(String(res.headers['access-control-allow-methods']), /POST/)
  } finally {
    delete process.env.CORS_ORIGIN
  }
})
