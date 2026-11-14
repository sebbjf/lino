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
