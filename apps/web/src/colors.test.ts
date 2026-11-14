import { expect, test } from 'vitest'
import { buildPalette, normalizeHex } from './colors.ts'
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
