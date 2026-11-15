import { expect, test } from 'vitest'
import { filterPixels, hexToOklch, surface, textOn } from './style.ts'

test('hexToOklch matches known values', () => {
  expect(hexToOklch('#ffffff')).toBe('oklch(1 0 0)')
  expect(hexToOklch('#000000')).toBe('oklch(0 0 0)')
  expect(hexToOklch('#ff0000')).toBe('oklch(0.628 0.258 29.2)')
  expect(hexToOklch('#0000ff')).toBe('oklch(0.452 0.313 264.1)')
})

test('textOn picks the readable text color', () => {
  expect(textOn('#ffffff')).toBe('#2b2723')
  expect(textOn('#fff3b0')).toBe('#2b2723')
  expect(textOn('#1e3a5f')).toBe('#ffffff')
  expect(textOn('#000')).toBe('#ffffff')
  expect(textOn('nope')).toBeNull()
})

test('surface defaults to soft corners with the class shadow', () => {
  expect(surface({})).toEqual({ borderRadius: 25 })
  expect(surface({ corner: 'square', shadow: false })).toEqual({ borderRadius: 0, boxShadow: 'none' })
})

test('filterPixels makes grey or blends between the duotone colors', () => {
  const px = () => new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 128])
  expect([...filterPixels(px(), 'mono')]).toEqual([255, 255, 255, 255, 0, 0, 0, 128])
  expect([...filterPixels(px(), 'duotone', ['#102030', '#f0e0d0'])]).toEqual([240, 224, 208, 255, 16, 32, 48, 128])
  expect([...filterPixels(new Uint8ClampedArray([255, 0, 0, 255]), 'mono')].slice(0, 3)).toEqual([54, 54, 54])
})
