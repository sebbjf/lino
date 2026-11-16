import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from './routes.ts'
import { StoreFullError, type BoardStore } from './boards.ts'

function memoryStore(): BoardStore {
  const rows = new Map<string, unknown>()
  return {
    async create(data) {
      const id = `board${rows.size}`.padEnd(12, 'x')
      rows.set(id, data)
      return id
    },
    get: async (id) => rows.get(id) ?? null,
  }
}

const board = {
  elements: [
    {
      id: 'a', type: 'note', text: 'hi', x: 0, y: 0, w: 100, h: 80, rotation: 0,
      bg: '#fff3b0', color: '#222222', size: 'xl', align: 'center', bold: true, italic: false, font: 'serif', family: 'Inter', corner: 'square', shadow: false, opacity: 0.6, deco: 'tape',
    },
    { id: 'b', type: 'color', hex: '#aabbcc', x: 10, y: 10, w: 100, h: 100, rotation: 5 },
    {
      id: 'c', type: 'link', url: 'https://example.com/', title: 'Ex', image: null,
      fonts: ['Inter'], colors: ['#112233'], status: 'ok', missing: [], x: 0, y: 0, w: 280, h: 140, rotation: 0,
    },
  ],
  colorMeta: { '#aabbcc': { name: 'sky', pinned: true } },
  board: { bg: '#1e3a5f', pattern: 'grid', messy: true },
}

const share = (app: ReturnType<typeof buildApp>, payload: unknown) => app.inject({ method: 'POST', url: '/boards', payload: payload as object })

test('share a board and read it back', async () => {
  const app = buildApp({ boards: memoryStore() })
  const res = await share(app, board)
  assert.equal(res.statusCode, 201)
  const { id } = res.json()
  const back = await app.inject({ method: 'GET', url: `/boards/${id}` })
  assert.equal(back.statusCode, 200)
  assert.deepEqual(back.json(), board)
})

test('unknown or malformed id is 404 or 400', async () => {
  const app = buildApp({ boards: memoryStore() })
  assert.equal((await app.inject({ method: 'GET', url: '/boards/AAAAAAAAAAAA' })).statusCode, 404)
  assert.equal((await app.inject({ method: 'GET', url: '/boards/short' })).statusCode, 400)
})

test('rejects content that would be unsafe to render', async () => {
  const app = buildApp({ boards: memoryStore() })
  const link = board.elements[2]
  const bad = [
    { ...link, url: 'javascript:alert(1)' },
    { ...link, image: 'https://tracker.example/pixel.png' },
    { id: 'i', type: 'image', src: 'data:text/html;base64,PHNjcmlwdD4=', x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    { id: 'i', type: 'image', x: 0, y: 0, w: 10, h: 10, rotation: 0 },
    { ...board.elements[1], hex: 'red;background:url(x)' },
    { ...board.elements[0], bg: 'red;background:url(x)' },
    { ...board.elements[0], opacity: 0 },
    { ...board.elements[0], corner: '9999px' },
    { id: 'i', type: 'image', src: 'data:image/png;base64,AA==', x: 0, y: 0, w: 10, h: 10, rotation: 0, duo: ['#000', 'url(x)'] },
    { ...board.elements[0], family: 'x", serif; } body {' },
    { ...link, url: 'https://' },
    { ...board.elements[1], x: 1e308 },
  ]
  for (const el of bad) assert.equal((await share(app, { elements: [el] })).statusCode, 400, JSON.stringify(el))
  assert.equal((await share(app, { elements: [] })).statusCode, 400)
  assert.equal((await share(app, { ...board, board: { bg: 'url(x)' } })).statusCode, 400)
  assert.equal((await share(app, { ...board, colorMeta: { 'red;}body{display:none}': { pinned: true } } })).statusCode, 400)
})

test('too large board is refused', async () => {
  const app = buildApp({ boards: memoryStore() })
  const src = `data:image/webp;base64,${'A'.repeat(4.1 * 1024 * 1024)}`
  const res = await share(app, { elements: [{ id: 'i', type: 'image', src, x: 0, y: 0, w: 10, h: 10, rotation: 0 }] })
  assert.equal(res.statusCode, 413)
})

test('share rate limit per IP', async () => {
  const app = buildApp({ boards: memoryStore(), sharesPerHour: 2 })
  for (const code of [201, 201, 429]) assert.equal((await share(app, board)).statusCode, code)
})

test('a store failure answers 500 without its message; a full store is 503', async () => {
  const failing = (e: Error): BoardStore => ({ create: () => Promise.reject(e), get: async () => null })
  const res = await share(buildApp({ boards: failing(new Error('password authentication failed for user "neondb_owner"')) }), board)
  assert.equal(res.statusCode, 500)
  assert.doesNotMatch(res.body, /neondb_owner/)
  assert.equal((await share(buildApp({ boards: failing(new StoreFullError()) }), board)).statusCode, 503)
})

test('behind one proxy, a forged X-Forwarded-For entry does not dodge the rate limit', async () => {
  // same setting as server.ts with TRUST_PROXY=1: only the entry the proxy itself appended counts
  const app = buildApp({ boards: memoryStore(), sharesPerHour: 1, trustProxy: (_addr: string, hop: number) => hop < 1 })
  const from = (forged: string) => app.inject({ method: 'POST', url: '/boards', payload: board, headers: { 'x-forwarded-for': `${forged}, 9.9.9.9` } })
  assert.equal((await from('1.1.1.1')).statusCode, 201)
  assert.equal((await from('2.2.2.2')).statusCode, 429)
})

test('sharing without a database is 503', async () => {
  assert.equal((await share(buildApp(), board)).statusCode, 503)
})
