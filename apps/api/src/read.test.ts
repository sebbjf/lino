import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from './app.ts'
import { findColors, findFonts, parseHtml, readLink } from './extract.ts'
import { BlockedError, checkUrl, isBlockedIp, safeLookup, type Fetcher } from './fetch.ts'

test('isBlockedIp blocks internal ranges, allows public ones', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '::1', '::', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:7f00:1', 'nope'])
    assert.equal(isBlockedIp(ip), true, ip)
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isBlockedIp(ip), false, ip)
})

test('checkUrl rejects schemes, ports, credentials and internal hosts', () => {
  for (const url of ['file:///etc/passwd', 'ftp://x.com', 'http://a:b@x.com', 'http://x.com:8080', 'http://127.1', 'http://0x7f000001', 'http://[::1]/', 'http://localhost/', 'http://a.localhost', 'not a url'])
    assert.throws(() => checkUrl(url), url)
  assert.equal(checkUrl('https://example.com/a').hostname, 'example.com')
})

test('safeLookup refuses names that resolve to internal addresses', async () => {
  const err = await new Promise((done) => safeLookup('localhost', { all: true }, (e) => done(e)))
  assert.ok(err instanceof BlockedError)
})

test('parseHtml reads og tags, title fallback, styles and stylesheets', () => {
  const html = `<html><head><title>Fallback &amp; co</title>
    <meta property="og:title" content="Hello &quot;world&quot;"><meta content='/cover.png' property='og:image'>
    <meta name="theme-color" content="#336699"><link rel="preload stylesheet" href="/a.css"><link rel="icon" href="/i.png">
    <style>body{font-family:"Inter",sans-serif}</style></head><body style="color:#abc"></body></html>`
  const p = parseHtml(html, new URL('https://x.com/page'))
  assert.equal(p.title, 'Hello "world"')
  assert.equal(p.image?.href, 'https://x.com/cover.png')
  assert.equal(p.themeColor, '#336699')
  assert.deepEqual(p.sheets.map(String), ['https://x.com/a.css'])
  assert.match(p.css, /Inter/)
  assert.match(p.css, /#abc/)
  assert.equal(parseHtml('<title> Only\n title </title>', new URL('https://x.com')).title, 'Only title')
})

test('findFonts keeps first family, drops generics and vars, sorts by use', () => {
  const css = `h1{font-family:'Fraunces', serif} p{font-family: Inter, system-ui} a{font-family:Inter} b{font-family: var(--f)} c{font-family:-apple-system, Roboto}`
  assert.deepEqual(findFonts(css), ['Inter', 'Fraunces'])
  assert.deepEqual(findFonts(':root{--f: var(--g); --g: "Mona Sans", sans-serif} body{font-family: var(--f)} p{font-family:var(--nope)}'), ['Mona Sans'])
})

test('findColors normalizes hex and rgb, drops white/black', () => {
  const css = `a{color:#FFF} b{color:#336699} c{background:#369} d{color:rgb(51, 102, 153)} e{color:#11223380} f{color:#000}`
  assert.deepEqual(findColors(css), ['#336699', '#112233'])
})

const fake =
  (pages: Record<string, { type: string; body: string }>): Fetcher =>
  async (url) => {
    const p = pages[url.href]
    if (!p) throw new Error('404')
    return { url, type: p.type, body: Buffer.from(p.body) }
  }

test('readLink combines page, stylesheets and cover; reports what is missing', async () => {
  const data = await readLink(
    'https://x.com/',
    fake({
      'https://x.com/': { type: 'text/html', body: '<meta property="og:image" content="/c.png"><link rel=stylesheet href=/s.css><link rel=stylesheet href=/gone.css>' },
      'https://x.com/s.css': { type: 'text/css', body: 'body{font-family:Inter;color:#123456}' },
      'https://x.com/c.png': { type: 'image/png', body: 'png' },
    }),
  )
  assert.deepEqual(data, {
    url: 'https://x.com/',
    title: null,
    image: `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
    fonts: ['Inter'],
    colors: ['#123456'],
    missing: ['title'],
  })
})

test('GET /read: 400 for internal URLs, 502 for failures, 429 over the limit', async () => {
  const app = buildApp({ fetcher: fake({ 'https://x.com/': { type: 'text/html', body: '<title>X</title>' } }), readsPerMinute: 3 })
  const get = (url: string) => app.inject({ method: 'GET', url: `/read?url=${encodeURIComponent(url)}` })
  assert.equal((await get('http://169.254.169.254/latest/meta-data')).statusCode, 400)
  assert.equal((await get('https://down.com/')).statusCode, 502)
  const ok = await get('https://x.com/')
  assert.equal(ok.statusCode, 200)
  assert.equal(ok.json().title, 'X')
  assert.equal((await get('https://x.com/')).statusCode, 429)
  assert.equal((await app.inject({ method: 'GET', url: '/read' })).statusCode, 400)
})
