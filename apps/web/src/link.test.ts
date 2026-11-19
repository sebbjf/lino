import { expect, test } from 'vitest'
import { bookmarklet, isImageUrl, sharedUrl } from './link.ts'

test('sharedUrl accepts only an http(s) URL in ?add=', () => {
  expect(sharedUrl('?add=' + encodeURIComponent('https://a.test/x?y=1'))).toBe('https://a.test/x?y=1')
  expect(sharedUrl('?add=javascript:alert(1)')).toBeNull()
  expect(sharedUrl('?add=')).toBeNull()
  expect(sharedUrl('')).toBeNull()
})

test('isImageUrl looks at the path, not the query', () => {
  expect(isImageUrl('https://a.test/p/cat.JPG?w=1')).toBe(true)
  expect(isImageUrl('https://a.test/cat.avif')).toBe(true)
  expect(isImageUrl('https://a.test/cat.png/page')).toBe(false)
  expect(isImageUrl('https://a.test/?f=cat.png')).toBe(false)
})

test('bookmarklet targets the given origin', () => {
  expect(bookmarklet('https://lino.test')).toContain("'https://lino.test/board/?add='")
})
