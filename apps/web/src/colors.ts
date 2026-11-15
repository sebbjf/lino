import type { BoardElement } from './store.ts'

export type ColorMeta = { name?: string; pinned?: boolean; hidden?: boolean }
export type PaletteColor = { hex: string; name: string; pinned: boolean }

/** '#ABC', 'abc', '#aabbcc' → '#aabbcc'; anything else → null. */
export function normalizeHex(value: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim())
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  return `#${h.toLowerCase()}`
}

/**
 * The board palette: every swatch and link colour plus pinned colours, minus removed ones, pinned first.
 * Unnamed colours get `color-N` in palette order.
 */
export function buildPalette(elements: BoardElement[], meta: Record<string, ColorMeta>) {
  const hexes = new Set<string>()
  for (const el of elements) {
    if (el.type === 'color') hexes.add(normalizeHex(el.hex) ?? el.hex)
    if (el.type === 'link') for (const hex of el.colors) hexes.add(hex)
  }
  for (const [hex, m] of Object.entries(meta)) if (m.pinned) hexes.add(hex)
  const all = [...hexes]
  const visible = all
    .filter((hex) => !meta[hex]?.hidden)
    .sort((a, b) => Number(!!meta[b]?.pinned) - Number(!!meta[a]?.pinned))
    .map((hex, i): PaletteColor => ({ hex, name: meta[hex]?.name || `color-${i + 1}`, pinned: !!meta[hex]?.pinned }))
  return { colors: visible, hidden: all.filter((hex) => meta[hex]?.hidden) }
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
