import { expect, test } from 'vitest'
import { normalizeHex } from './colors.ts'

test('normalizeHex', () => {
  expect(normalizeHex('#ABC')).toBe('#aabbcc')
  expect(normalizeHex(' d6c7b4 ')).toBe('#d6c7b4')
  expect(normalizeHex('#abcd')).toBeNull()
  expect(normalizeHex('red')).toBeNull()
})
