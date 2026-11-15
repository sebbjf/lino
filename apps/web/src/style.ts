import type { CSSProperties } from 'react'
import { normalizeHex } from './colors.ts'

export type Corner = 'square' | 'soft' | 'round'
export type NoteSize = 'sm' | 'md' | 'lg'
export type NoteFont = 'sans' | 'serif'
export type Pattern = 'dots' | 'grid' | 'plain'

/** Optional look of any element; missing fields mean the default (soft corners, shadow, opaque). */
export type ElementStyle = { corner?: Corner; shadow?: boolean; opacity?: number }
/** Notes only; `bg` unset means the theme's card color. */
export type NoteStyle = { bg?: string; size?: NoteSize; font?: NoteFont }
/** The canvas; `bg` unset means the theme background. */
export type BoardStyle = { bg?: string; pattern?: Pattern }

export const CORNERS: Corner[] = ['square', 'soft', 'round']
export const NOTE_SIZES: NoteSize[] = ['sm', 'md', 'lg']
export const NOTE_FONTS: NoteFont[] = ['sans', 'serif']
export const PATTERNS: Pattern[] = ['dots', 'grid', 'plain']

/** Corner radius in px; soft matches rounded-2xl with the theme radius. */
export const RADIUS: Record<Corner, number> = { square: 0, soft: 25, round: 48 }
/** Font size and line height in px. */
export const NOTE_TEXT: Record<NoteSize, [number, number]> = { sm: [13, 20], md: [15, 24], lg: [20, 30] }
export const MIN_OPACITY = 0.2

/** Inline styles for an element's surface; they override the default rounded-2xl/shadow-soft classes. */
export function surface(s: ElementStyle): CSSProperties {
  return { borderRadius: RADIUS[s.corner ?? 'soft'], ...(s.shadow === false && { boxShadow: 'none' }) }
}

function channels(hex: string) {
  const h = normalizeHex(hex)
  if (!h) return null
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string) {
  const c = channels(hex)
  if (!c) return null
  const [r, g, b] = c.map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const DARK_TEXT = '#2b2723'
const LIGHT_TEXT = '#ffffff'

/** Dark or light text, whichever contrasts more with the background. Null for unreadable input. */
export function textOn(bg: string) {
  const l = luminance(bg)
  if (l === null) return null
  const dark = luminance(DARK_TEXT)!
  return (l + 0.05) / (dark + 0.05) >= 1.05 / (l + 0.05) ? DARK_TEXT : LIGHT_TEXT
}

/** '#ff0000' → 'oklch(0.628 0.258 29.2)' (Björn Ottosson's OKLab matrices). */
export function hexToOklch(hex: string) {
  const c = channels(hex)
  if (!c) return hex
  const [r, g, b] = c.map(linear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const C = Math.hypot(A, B)
  // greys have no meaningful hue
  const H = C < 0.0005 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360
  const n = (v: number, d: number) => String(Number(v.toFixed(d)))
  return `oklch(${n(L, 3)} ${n(C < 0.0005 ? 0 : C, 3)} ${n(H, 1)})`
}
