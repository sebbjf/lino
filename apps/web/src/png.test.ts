import { expect, test } from 'vitest'
import { wrapText } from './png.ts'

const measure = (s: string) => s.length // one unit per character

test('wrapText breaks on words and keeps paragraphs', () => {
  expect(wrapText('aa bb cc dd', 5, measure)).toEqual(['aa bb', 'cc dd'])
  expect(wrapText('one\n\ntwo', 10, measure)).toEqual(['one', '', 'two'])
  expect(wrapText('verylongword x', 4, measure)).toEqual(['verylongword', 'x'])
})
