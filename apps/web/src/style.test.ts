import { expect, test } from 'vitest'
import { hexToOklch, surface, textOn } from './style.ts'

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
