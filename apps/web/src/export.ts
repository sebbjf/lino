import type { PaletteColor } from './colors.ts'
import type { ExportPrefs } from './store.ts'
import { hexToOklch } from './style.ts'

/** 'Brand Blue!' → 'brand-blue'; empty results fall back. */
export function slug(name: string, fallback: string) {
  const s = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || fallback
}

function fallbackFamily(font: string) {
  const f = font.toLowerCase()
  if (/mono|code/.test(f)) return 'monospace'
  if (/serif/.test(f) && !/sans/.test(f)) return 'serif'
  return 'sans-serif'
}

function uniqueNames() {
  const used = new Map<string, number>()
  return (name: string) => {
    const n = (used.get(name) ?? 0) + 1
    used.set(name, n)
    return n === 1 ? name : `${name}-${n}`
  }
}

const isHex = (c: PaletteColor) => /^#[0-9a-f]{3,8}$/i.test(c.hex)

/** Custom-property lines for colours and fonts; repeated names get -2, -3... `pre` goes right after `--`. */
function lines(colors: PaletteColor[], fonts: string[], pre: string, oklch: boolean) {
  const unique = uniqueNames()
  // hex values and font names can come from someone else's board: nothing that could close the block gets into the CSS
  return [
    ...colors
      .filter(isHex)
      .map((c, i) => `  --${pre}color-${unique(slug(c.name, `color-${i + 1}`))}: ${oklch ? hexToOklch(c.hex) : c.hex};`),
    ...fonts.map((f, i) => `  --${pre}font-${unique(slug(f, `font-${i + 1}`))}: "${f.replace(/[^\p{L}\p{N} ._'-]/gu, '')}", ${fallbackFamily(f)};`),
  ]
}

export type ExportFormat = 'css' | 'tailwind' | 'tokens'

/** Design Tokens (W3C format) JSON, read by Style Dictionary and Figma token plugins. Colours stay hex. */
function tokens(colors: PaletteColor[], fonts: string[]) {
  const unique = uniqueNames()
  const color = Object.fromEntries(colors.filter(isHex).map((c, i) => [unique(slug(c.name, `color-${i + 1}`)), { $type: 'color', $value: c.hex }]))
  const font = Object.fromEntries(fonts.map((f, i) => [unique(slug(f, `font-${i + 1}`)), { $type: 'fontFamily', $value: [f, fallbackFamily(f)] }]))
  return JSON.stringify({ color, font }, null, 2) + '\n'
}

/**
 * CSS variables on :root, a Tailwind v4 @theme block (gives bg-brand, font-inter, ...), or design tokens JSON.
 * The prefix only applies to CSS: Tailwind reads --color-* and --font-* by name.
 */
export function exportTheme(format: ExportFormat, colors: PaletteColor[], fonts: string[], prefs: ExportPrefs = { prefix: '', format: 'hex' }) {
  if (format === 'tokens') return tokens(colors, fonts)
  const head = format === 'css' ? ':root {' : '@theme {'
  const p = format === 'css' ? slug(prefs.prefix, '') : ''
  return [head, ...lines(colors, fonts, p && `${p}-`, prefs.format === 'oklch'), '}', ''].join('\n')
}
