import { expect, test } from 'vitest'
import { DEFAULTS, isDark, parseSettings } from './settings.ts'

test('unknown or malformed stored settings fall back to the defaults', () => {
  expect(parseSettings(null)).toEqual(DEFAULTS)
  expect(parseSettings('{oops')).toEqual(DEFAULTS)
  expect(parseSettings('{"theme":"neon","snap":"no","newPattern":"x"}')).toEqual(DEFAULTS)
  expect(parseSettings('{"theme":"dark","snap":false,"newPattern":"grid","newMessy":true}')).toEqual({ theme: 'dark', snap: false, newPattern: 'grid', newMessy: true })
})

test('system theme follows the OS, an explicit one wins', () => {
  expect(isDark('system', true)).toBe(true)
  expect(isDark('light', true)).toBe(false)
  expect(isDark('dark', false)).toBe(true)
})
