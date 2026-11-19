import { expect, test } from 'vitest'
import { boardFonts, buildPalette, dominantColors, harmonies, normalizeHex, shuffledOrder } from './colors.ts'
import type { BoardElement } from './store.ts'

test('normalizeHex', () => {
  expect(normalizeHex('#ABC')).toBe('#aabbcc')
  expect(normalizeHex(' d6c7b4 ')).toBe('#d6c7b4')
  expect(normalizeHex('#abcd')).toBeNull()
  expect(normalizeHex('red')).toBeNull()
})

const swatch = (hex: string) => ({ id: hex, type: 'color', hex, x: 0, y: 0, w: 1, h: 1, rotation: 0 }) as BoardElement

test('buildPalette dedupes, pins first, keeps pinned without swatch, hides removed', () => {
  const els = [swatch('#111111'), swatch('#222222'), swatch('#111111'), swatch('#333333')]
  const { colors, hidden } = buildPalette(els, {
    '#222222': { name: 'brand' },
    '#333333': { pinned: true },
    '#444444': { pinned: true }, // swatch was deleted, still in palette
    '#111111': { hidden: true },
  })
  expect(colors.map((c) => c.hex)).toEqual(['#333333', '#444444', '#222222'])
  expect(colors.map((c) => c.name)).toEqual(['color-1', 'color-2', 'brand'])
  expect(hidden).toEqual(['#111111'])
})

test('buildPalette skips images opted out of the palette', () => {
  const img = (paletteOff?: boolean) => ({ id: 'i', type: 'image', src: '', colors: ['#abcdef'], paletteOff, x: 0, y: 0, w: 1, h: 1, rotation: 0 }) as BoardElement
  expect(buildPalette([img(true), img()], {}).colors.map((c) => c.hex)).toEqual(['#abcdef'])
  expect(buildPalette([img(true)], {}).colors).toEqual([])
})

test('buildPalette reads image colours; images saved before they had any add none', () => {
  const img = (colors?: string[]) => ({ id: 'i', type: 'image', src: '', colors, x: 0, y: 0, w: 1, h: 1, rotation: 0 }) as BoardElement
  expect(buildPalette([img(['#abcdef', '#123456']), img()], {}).colors.map((c) => c.hex)).toEqual(['#abcdef', '#123456'])
})

test('buildPalette and boardFonts read link elements', () => {
  const link = (colors: string[], fonts: string[]) => ({ id: 'l', type: 'link', colors, fonts, x: 0, y: 0, w: 1, h: 1, rotation: 0 }) as unknown as BoardElement
  const els = [swatch('#111111'), link(['#111111', '#abcdef'], ['Inter']), link([], ['inter', 'Fraunces'])]
  expect(buildPalette(els, {}).colors.map((c) => c.hex)).toEqual(['#111111', '#abcdef'])
  expect(boardFonts(els)).toEqual(['Inter', 'Fraunces'])
})

test('dominantColors: most common first, skips transparent and near duplicates', () => {
  const px = (r: number, g: number, b: number, a = 255, times = 1) => Array.from({ length: times }, () => [r, g, b, a]).flat()
  const data = new Uint8ClampedArray([...px(200, 30, 30, 255, 5), ...px(205, 32, 30, 255, 3), ...px(20, 20, 200, 255, 4), ...px(0, 255, 0, 0, 9)])
  expect(dominantColors(data, 3)).toEqual(['#c81e1e', '#1414c8'])
})

test('harmonies rotate the hue and keep saturation and lightness', () => {
  const [comp, ana, tri] = harmonies('#ff0000')
  expect(comp.colors).toEqual(['#00ffff'])
  expect(ana.colors).toEqual(['#ff0080', '#ff8000'])
  expect(tri.colors).toEqual(['#0000ff', '#00ff00'])
  expect(harmonies('#808080')[0].colors).toEqual(['#808080'])
  expect(harmonies('nope')).toEqual([])
})

test('shuffled order reorders the palette, pinned colors still first', () => {
  const els = ['#111111', '#222222', '#333333'].map((hex) => ({ type: 'color', hex }) as BoardElement)
  const order = shuffledOrder(['#111111', '#222222', '#333333'], () => 0) // fixed "random" for a deterministic order
  const meta = Object.fromEntries(Object.entries(order).map(([hex, o]) => [hex, { order: o }]))
  const shuffled = buildPalette(els, meta).colors.map((c) => c.hex)
  expect(shuffled).toEqual(Object.entries(order).sort((a, b) => a[1] - b[1]).map(([hex]) => hex))
  meta['#333333'] = { ...meta['#333333'], pinned: true } as { order: number }
  expect(buildPalette(els, meta).colors[0].hex).toBe('#333333')
})
