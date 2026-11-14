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
 * The board palette: every swatch colour plus pinned colours, minus removed ones, pinned first.
 * Unnamed colours get `color-N` in palette order.
 */
export function buildPalette(elements: BoardElement[], meta: Record<string, ColorMeta>) {
  const hexes = new Set<string>()
  for (const el of elements) if (el.type === 'color') hexes.add(normalizeHex(el.hex) ?? el.hex)
  for (const [hex, m] of Object.entries(meta)) if (m.pinned) hexes.add(hex)
  const all = [...hexes]
  const visible = all
    .filter((hex) => !meta[hex]?.hidden)
    .sort((a, b) => Number(!!meta[b]?.pinned) - Number(!!meta[a]?.pinned))
    .map((hex, i): PaletteColor => ({ hex, name: meta[hex]?.name || `color-${i + 1}`, pinned: !!meta[hex]?.pinned }))
  return { colors: visible, hidden: all.filter((hex) => meta[hex]?.hidden) }
}
