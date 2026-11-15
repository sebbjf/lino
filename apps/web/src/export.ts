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

/** Custom-property lines for colours and fonts; repeated names get -2, -3... `pre` goes right after `--`. */
function lines(colors: PaletteColor[], fonts: string[], pre: string, oklch: boolean) {
  const used = new Map<string, number>()
  const unique = (name: string) => {
    const n = (used.get(name) ?? 0) + 1
    used.set(name, n)
    return n === 1 ? name : `${name}-${n}`
  }
  return [
    ...colors.map((c, i) => `  --${pre}color-${unique(slug(c.name, `color-${i + 1}`))}: ${oklch ? hexToOklch(c.hex) : c.hex};`),
    ...fonts.map((f, i) => `  --${pre}font-${unique(slug(f, `font-${i + 1}`))}: "${f.replace(/["\\]/g, '')}", ${fallbackFamily(f)};`),
  ]
}

export type ExportFormat = 'css' | 'tailwind'

/**
 * CSS variables on :root, or a Tailwind v4 @theme block (gives bg-brand, font-inter, ...).
 * The prefix only applies to CSS: Tailwind reads --color-* and --font-* by name.
 */
export function exportTheme(format: ExportFormat, colors: PaletteColor[], fonts: string[], prefs: ExportPrefs = { prefix: '', format: 'hex' }) {
  const head = format === 'css' ? ':root {' : '@theme {'
  const p = format === 'css' ? slug(prefs.prefix, '') : ''
  return [head, ...lines(colors, fonts, p && `${p}-`, prefs.format === 'oklch'), '}', ''].join('\n')
}
