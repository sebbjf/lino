import { BlockedError, checkUrl, safeFetch, type Fetcher } from './fetch.ts'

export type LinkData = {
  url: string
  title: string | null
  /** Cover image as a data URL, so the browser can keep it and sample its colours. */
  image: string | null
  fonts: string[]
  colors: string[]
  missing: ('title' | 'image' | 'fonts' | 'colors')[]
}

const PAGE_BYTES = 2_000_000
const CSS_BYTES = 500_000
const IMAGE_BYTES = 3_000_000
const MAX_SHEETS = 8
const TIMEOUT_MS = 8000

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) =>
  s
    .replace(/&#(x?)([0-9a-f]+);/gi, (_, x, n) => String.fromCodePoint(parseInt(n, x ? 16 : 10)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()

function attrs(tag: string) {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g))
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4])
  return out
}

const resolve = (href: string | undefined, base: URL) => {
  try {
    return href ? new URL(href, base) : null
  } catch {
    return null
  }
}

/** Title, cover, theme colour, inline CSS and stylesheet links. Regexes, not a DOM: we only need the head. */
export function parseHtml(html: string, base: URL) {
  const meta: Record<string, string> = {}
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(tag)
    const key = (a.property ?? a.name)?.toLowerCase()
    if (key && a.content && !(key in meta)) meta[key] = a.content
  }
  const sheets: URL[] = []
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const a = attrs(tag)
    const url = a.rel?.toLowerCase().split(/\s+/).includes('stylesheet') && resolve(a.href, base)
    if (url) sheets.push(url)
  }
  const css = [
    ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]),
    ...[...html.matchAll(/\sstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]),
  ].join('\n')
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]
  return {
    title: meta['og:title'] || meta['twitter:title'] || (titleTag && decode(titleTag)) || null,
    image: resolve(meta['og:image'] || meta['twitter:image'] || meta['og:image:url'], base),
    themeColor: meta['theme-color'] ?? null,
    css,
    sheets,
  }
}

// Generic families and system-font aliases: they say nothing about the design.
const GENERIC = new Set([
  ...'serif sans-serif monospace cursive fantasy system-ui ui-sans-serif ui-serif ui-monospace ui-rounded emoji math fangsong'.split(' '),
  ...'inherit initial unset revert revert-layer -apple-system blinkmacsystemfont'.split(' '),
  ...['segoe ui', 'apple color emoji', 'segoe ui emoji', 'segoe ui symbol', 'noto color emoji'],
])

/** First family of every font-family declaration, most used first, generics dropped. */
export function findFonts(css: string, limit = 4) {
  // design systems put the stack in a custom property: font-family: var(--font-sans)
  const vars = new Map<string, string>()
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;}{]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2])
  const first = (value: string, depth = 0): string => {
    const name = value.split(',')[0].trim()
    const v = /^var\(\s*(--[\w-]+)/.exec(name)?.[1]
    return v && vars.has(v) && depth < 3 ? first(vars.get(v)!, depth + 1) : name
  }
  const counts = new Map<string, { name: string; n: number }>()
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{!]+)/gi)) {
    const name = first(m[1]).replace(/^["']|["']$/g, '').trim()
    const key = name.toLowerCase()
    if (!name || name.startsWith('var(') || GENERIC.has(key) || name.length > 60) continue
    const c = counts.get(key) ?? { name, n: 0 }
    c.n++
    counts.set(key, c)
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).slice(0, limit).map((c) => c.name)
}

const hex2 = (n: number) => Math.min(255, n).toString(16).padStart(2, '0')

/** Hex and rgb() colours, most used first; pure white and black are left out as noise. */
export function findColors(css: string, limit = 6) {
  const counts = new Map<string, number>()
  const bump = (hex: string) => counts.set(hex, (counts.get(hex) ?? 0) + 1)
  for (const m of css.matchAll(/#([0-9a-f]{3,8})\b/gi)) {
    const h = m[1].toLowerCase()
    if (h.length === 3 || h.length === 4) bump('#' + [...h.slice(0, 3)].map((c) => c + c).join(''))
    else if (h.length === 6 || h.length === 8) bump('#' + h.slice(0, 6))
  }
  for (const m of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi))
    bump('#' + [m[1], m[2], m[3]].map((n) => hex2(Number(n))).join(''))
  counts.delete('#ffffff')
  counts.delete('#000000')
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([hex]) => hex)
}

/** Reads a page and returns what it could find; parts that fail are listed in `missing`, not thrown. */
export async function readLink(raw: string, fetcher: Fetcher = safeFetch): Promise<LinkData> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  const page = await fetcher(checkUrl(raw), { maxBytes: PAGE_BYTES, accept: 'text/html,application/xhtml+xml', signal })
  if (!/html/i.test(page.type)) throw new BlockedError('That link is not a web page.')
  const parsed = parseHtml(page.body.toString('utf8'), page.url)

  const [sheets, image] = await Promise.all([
    Promise.allSettled(
      parsed.sheets.slice(0, MAX_SHEETS).map((u) => fetcher(u, { maxBytes: CSS_BYTES, accept: 'text/css', signal })),
    ),
    parsed.image
      ? fetcher(parsed.image, { maxBytes: IMAGE_BYTES, accept: 'image/*', signal }).then(
          (r) => (/^image\//.test(r.type) ? `data:${r.type.split(';')[0]};base64,${r.body.toString('base64')}` : null),
          () => null,
        )
      : null,
  ])
  const css = [parsed.css, ...sheets.flatMap((s) => (s.status === 'fulfilled' ? [s.value.body.toString('utf8')] : []))].join('\n')

  const fonts = findFonts(css)
  const theme = parsed.themeColor && findColors(parsed.themeColor + ';', 1)
  const colors = [...new Set([...(theme || []), ...findColors(css)])].slice(0, 6)
  const data = { url: page.url.href, title: parsed.title, image, fonts, colors }
  const missing = (['title', 'image', 'fonts', 'colors'] as const).filter((k) => !data[k]?.length)
  return { ...data, missing }
}
