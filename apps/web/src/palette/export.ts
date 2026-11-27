import type { PaletteColor } from './colors.ts'
import type { ExportPrefs } from '../board/store.ts'
import { hexToOklch, toneScale } from '../board/style.ts'

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
function lines(colors: PaletteColor[], fonts: string[], pre: string, oklch: boolean, scales: boolean) {
  const unique = uniqueNames()
  // hex values and font names can come from someone else's board: nothing that could close the block gets into the CSS
  return [
    ...colors
      .filter(isHex)
      .flatMap((c, i) => {
        const name = unique(slug(c.name, `color-${i + 1}`))
        const val = (h: string) => (oklch ? hexToOklch(h) : h)
        // tone names go through `unique` too, so a colour named 'blue-50' can't clash with blue's 50 tone
        const tones = Object.entries((scales && toneScale(c.hex)) || {}).map(([k, h]) => `  --${pre}color-${unique(`${name}-${k}`)}: ${val(h)};`)
        return [`  --${pre}color-${name}: ${val(c.hex)};`, ...tones]
      }),
    ...fonts.map((f, i) => `  --${pre}font-${unique(slug(f, `font-${i + 1}`))}: "${f.replace(/[^\p{L}\p{N} ._'-]/gu, '')}", ${fallbackFamily(f)};`),
  ]
}

export const EXPORT_FORMATS = ['css', 'tailwind', 'tokens'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

/** Design Tokens (W3C format) JSON, read by Style Dictionary and Figma token plugins. Colours stay hex. */
function tokens(colors: PaletteColor[], fonts: string[], scales: boolean) {
  const unique = uniqueNames()
  const color = Object.fromEntries(colors.filter(isHex).map((c, i) => {
    const tones = scales && toneScale(c.hex)
    return [
      unique(slug(c.name, `color-${i + 1}`)),
      // a token with $value can't have children, so scales make the colour a group with `base` + tones
      tones
        ? { $type: 'color', base: { $value: c.hex }, ...Object.fromEntries(Object.entries(tones).map(([k, h]) => [k, { $value: h }])) }
        : { $type: 'color', $value: c.hex },
    ]
  }))
  const font = Object.fromEntries(fonts.map((f, i) => [unique(slug(f, `font-${i + 1}`)), { $type: 'fontFamily', $value: [f, fallbackFamily(f)] }]))
  return JSON.stringify({ color, font }, null, 2) + '\n'
}

/**
 * CSS variables on :root, a Tailwind v4 @theme block (gives bg-brand, font-inter, ...), or design tokens JSON.
 * The prefix only applies to CSS: Tailwind reads --color-* and --font-* by name.
 */
export function exportTheme(format: ExportFormat, colors: PaletteColor[], fonts: string[], prefs: ExportPrefs = { prefix: '', format: 'hex' }) {
  if (format === 'tokens') return tokens(colors, fonts, !!prefs.scales)
  const head = format === 'css' ? ':root {' : '@theme {'
  const p = format === 'css' ? slug(prefs.prefix, '') : ''
  return [head, ...lines(colors, fonts, p && `${p}-`, prefs.format === 'oklch', !!prefs.scales), '}', ''].join('\n')
}
