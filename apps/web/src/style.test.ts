import { expect, test } from 'vitest'
import { filterPixels, hexToOklch, luminance, surface, textOn, toneScale } from './style.ts'

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

test('toneScale is monotonic, valid hex, and keeps the hue', () => {
  for (const hex of ['#3366cc', '#ff0000', '#00ff88', '#777777', '#000000', '#ffffff']) {
    const tones = Object.values(toneScale(hex)!)
    expect(tones).toHaveLength(10)
    tones.forEach((t) => expect(t).toMatch(/^#[0-9a-f]{6}$/))
    const lum = tones.map((t) => luminance(t)!)
    lum.slice(1).forEach((v, i) => expect(v).toBeLessThan(lum[i]))
  }
  const hue = (h: string) => Number(hexToOklch(h).match(/ ([\d.]+)\)$/)![1])
  const t = toneScale('#3366cc')!
  for (const k of [200, 500, 800] as const) expect(Math.abs(hue(t[k]) - hue('#3366cc'))).toBeLessThan(12)
})
