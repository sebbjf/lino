import type { PaletteColor } from './colors.ts'
import { luminance } from '../board/style.ts'

export type ContrastLevel = 'AAA' | 'AA' | 'AA-large'

/** WCAG contrast ratio of two colours, 1 to 21, or null if either is not a hex colour. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a)
  const lb = luminance(b)
  if (la === null || lb === null) return null
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function levelFor(ratio: number): ContrastLevel {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  return 'AA-large'
}

/**
 * Every unordered pair of colours whose contrast is at least `min`, best first.
 * `bg` is the lighter colour and `fg` the darker one; ratios are floored to 1 decimal.
 */
export function contrastPairs(colors: PaletteColor[], min = 3) {
  const pairs: { fg: PaletteColor; bg: PaletteColor; ratio: number; level: ContrastLevel }[] = []
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const ratio = contrastRatio(colors[i].hex, colors[j].hex)
      if (ratio === null) continue
      // WCAG forbids rounding up to a threshold: compare the raw ratio, round only what is shown
      if (ratio < min) continue
      const lighter = luminance(colors[i].hex)! >= luminance(colors[j].hex)!
      const [bg, fg] = lighter ? [colors[i], colors[j]] : [colors[j], colors[i]]
      pairs.push({ fg, bg, ratio: Math.floor(ratio * 10) / 10, level: levelFor(ratio) })
    }
  }
  return pairs.sort((x, y) => y.ratio - x.ratio)
}
