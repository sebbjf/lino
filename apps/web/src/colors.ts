import type { BoardElement } from './store.ts'
import { normalizeHex } from './kinds/check.ts'
import { colorsOf } from './kinds/index.ts'

/** `order` comes from shuffling; colors without one keep board order after those that have one. */
export type ColorMeta = { name?: string; pinned?: boolean; hidden?: boolean; order?: number }
export type PaletteColor = { hex: string; name: string; pinned: boolean }
export { normalizeHex }

/**
 * The board palette: every swatch, link and image colour plus pinned colours, minus removed ones, pinned first.
 * Unnamed colours get `color-N` in palette order.
 */
export function buildPalette(elements: BoardElement[], meta: Record<string, ColorMeta>) {
  const hexes = new Set<string>()
  for (const el of elements) for (const hex of colorsOf(el)) hexes.add(hex)
  for (const [hex, m] of Object.entries(meta)) if (m.pinned) hexes.add(hex)
  const all = [...hexes]
  const visible = all
    .filter((hex) => !meta[hex]?.hidden)
    .map((hex, i) => ({ hex, key: meta[hex]?.order ?? all.length + i }))
    .sort((a, b) => Number(!!meta[b.hex]?.pinned) - Number(!!meta[a.hex]?.pinned) || a.key - b.key)
    .map(({ hex }) => hex)
    .map((hex, i): PaletteColor => ({ hex, name: meta[hex]?.name || `color-${i + 1}`, pinned: !!meta[hex]?.pinned }))
  return { colors: visible, hidden: all.filter((hex) => meta[hex]?.hidden) }
}

/** Random order values for a set of colors (Fisher-Yates), to shuffle the palette. */
export function shuffledOrder(hexes: string[], random = Math.random) {
  const a = [...hexes]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return Object.fromEntries(a.map((hex, i) => [hex, i]))
}

function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (!d) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

function fromHsl(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return '#' + [0, 8, 4].map((n) => toHex(Math.round(f(n) * 255))).join('')
}

/** Classic hue rotations of a color: complementary, analogous (±30°) and triad (±120°). */
export function harmonies(hex: string) {
  const h = normalizeHex(hex)
  if (!h) return []
  const [hue, s, l] = toHsl(h)
  const turn = (deg: number) => fromHsl((hue + deg + 360) % 360, s, l)
  return [
    { name: 'Complementary', colors: [turn(180)] },
    { name: 'Analogous', colors: [turn(-30), turn(30)] },
    { name: 'Triad', colors: [turn(-120), turn(120)] },
  ]
}

/** Fonts found on the board's links, deduped case-insensitively, in board order. */
export function boardFonts(elements: BoardElement[]) {
  const fonts = new Map<string, string>()
  for (const el of elements) if (el.type === 'link') for (const f of el.fonts) if (!fonts.has(f.toLowerCase())) fonts.set(f.toLowerCase(), f)
  return [...fonts.values()]
}

const toHex = (n: number) => n.toString(16).padStart(2, '0')

/**
 * Most common colours in RGBA pixel data. Pixels go into 4-bit-per-channel buckets; each bucket
 * reports its average colour. Transparent pixels are skipped, and buckets too close to one already
 * picked are passed over so the result is not five shades of the same grey.
 */
export function dominantColors(data: Uint8ClampedArray, n: number) {
  const buckets = new Map<number, { r: number; g: number; b: number; count: number }>()
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4)
    const b = buckets.get(key) ?? { r: 0, g: 0, b: 0, count: 0 }
    b.r += data[i]
    b.g += data[i + 1]
    b.b += data[i + 2]
    b.count++
    buckets.set(key, b)
  }
  const picked: [number, number, number][] = []
  for (const b of [...buckets.values()].sort((x, y) => y.count - x.count)) {
    const c: [number, number, number] = [b.r / b.count, b.g / b.count, b.b / b.count].map(Math.round) as [number, number, number]
    if (picked.some((p) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < 48)) continue
    picked.push(c)
    if (picked.length === n) break
  }
  return picked.map((c) => '#' + c.map(toHex).join(''))
}
