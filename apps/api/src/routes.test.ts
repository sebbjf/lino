import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from './routes.ts'

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
  process.env.CORS_ORIGIN = 'https://lino.test/' // trailing slash is ignored
  try {
    const res = await buildApp().inject({ method: 'OPTIONS', url: '/boards' })
    assert.equal(res.statusCode, 204)
    assert.equal(res.headers['access-control-allow-origin'], 'https://lino.test')
    assert.match(String(res.headers['access-control-allow-methods']), /POST/)
  } finally {
    delete process.env.CORS_ORIGIN
  }
})

test('image elements may carry paletteOff as a boolean', async () => {
  const { elementSchema } = await import('./elementSchema.ts')
  assert.equal(elementSchema.properties.paletteOff.type, 'boolean')
})

// Pinned with the web side (snapshot.test.ts, "limits match the share API"): change one, change both.
test('shared element limits', async () => {
  const { elementSchema } = await import('./elementSchema.ts')
  const p = elementSchema.properties
  assert.deepEqual([p.x.minimum, p.x.maximum, p.y.minimum, p.y.maximum], [-1e6, 1e6, -1e6, 1e6])
  assert.deepEqual([p.w.minimum, p.w.maximum, p.h.minimum, p.h.maximum], [1, 10_000, 1, 10_000])
  assert.equal(p.text.maxLength, 10_000)
})

test('frames, groups and headings are allowed in a shared board', async () => {
  const { elementSchema } = await import('./elementSchema.ts')
  assert.ok(elementSchema.properties.type.enum.includes('frame'))
  assert.equal(elementSchema.properties.groupId.type, 'string')
  assert.equal(elementSchema.properties.heading.type, 'boolean')
  assert.ok(JSON.stringify(elementSchema.allOf).includes('"frame"'))
})
