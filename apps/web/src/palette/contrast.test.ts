import { expect, test } from 'vitest'
import { contrastPairs, contrastRatio } from './contrast.ts'
import type { PaletteColor } from './colors.ts'

const color = (hex: string, name = hex): PaletteColor => ({ hex, name, pinned: false })

test('contrastRatio: black/white is 21, same colour is 1, order does not matter', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21)
  expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21)
  expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1)
  expect(contrastRatio('red', '#ffffff')).toBeNull()
})

test('contrastPairs: each unordered pair once, pairs below min excluded', () => {
  const colors = [color('#ffffff'), color('#aaaaaa'), color('#000000')]
  // #aaaaaa on white is about 2.3, below the default 3
  const pairs = contrastPairs(colors)
  expect(pairs.map((p) => [p.fg.hex, p.bg.hex])).toEqual([
    ['#000000', '#ffffff'],
    ['#000000', '#aaaaaa'],
  ])
  expect(contrastPairs(colors, 2)).toHaveLength(3)
})

test('contrastPairs: bg is the lighter colour, sorted best ratio first, levels', () => {
  const pairs = contrastPairs([color('#767676', 'grey'), color('#000000', 'black'), color('#ffffff', 'white'), color('#949494', 'light grey')])
  // grey/light grey is 1.5, so it is left out
  expect(pairs.map((p) => [p.fg.name, p.bg.name])).toEqual([
    ['black', 'white'],
    ['black', 'light grey'],
    ['black', 'grey'],
    ['grey', 'white'],
    ['light grey', 'white'],
  ])
  expect(pairs[0]).toMatchObject({ fg: { name: 'black' }, bg: { name: 'white' }, ratio: 21, level: 'AAA' })
  expect(pairs.map((p) => p.ratio)).toEqual([...pairs.map((p) => p.ratio)].sort((a, b) => b - a))
  expect(pairs.find((p) => p.fg.name === 'grey' && p.bg.name === 'white')).toMatchObject({ ratio: 4.5, level: 'AA' })
  expect(pairs.find((p) => p.fg.name === 'light grey' && p.bg.name === 'white')).toMatchObject({ ratio: 3, level: 'AA-large' })
})

test('levels use the raw ratio and the shown ratio never rounds up', () => {
  const [p] = contrastPairs([color('#777777'), color('#ffffff')])
  expect(p.level).toBe('AA-large')
  expect(p.ratio).toBe(4.4)
})
