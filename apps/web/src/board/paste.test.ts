import { expect, test } from 'vitest'
import { pasteAction } from './paste.ts'

const png = new File([], 'one.png', { type: 'image/png' })
const jpeg = new File([], 'two.jpg', { type: 'image/jpeg' })
const pdf = new File([], 'document.pdf', { type: 'application/pdf' })

test('image files take precedence over text and retain their order', () => {
  expect(pasteAction('#abc', [png, pdf, jpeg])).toEqual({ type: 'images', files: [png, jpeg] })
  expect(pasteAction('https://example.com', [png])).toEqual({ type: 'images', files: [png] })
  expect(pasteAction(undefined, [jpeg])).toEqual({ type: 'images', files: [jpeg] })
})

test.each([
  ['  #AbC  ', '#aabbcc'],
  ['ABC', '#aabbcc'],
  ['#123ABC', '#123abc'],
  ['123ABC', '#123abc'],
])('normalizes %s to a color', (text, hex) => {
  expect(pasteAction(text, [pdf])).toEqual({ type: 'color', hex })
})

test('a single HTTP(S) URL becomes a link', () => {
  expect(pasteAction('  HTTPS://Example.COM  ', [pdf])).toEqual({ type: 'link', url: 'https://example.com/' })
  expect(pasteAction('http://example.com/image.png', [])).toEqual({ type: 'link', url: 'http://example.com/image.png' })
})

test.each(['  a note\nwith two lines  ', '#abcd', 'http://?', 'https://example.com more text', 'ftp://example.com'])(
  'keeps %j as a trimmed note',
  (text) => {
    expect(pasteAction(text, [pdf])).toEqual({ type: 'note', text: text.trim() })
  },
)

test.each([undefined, '', '  \n\t '])('ignores blank clipboard text %j and non-image files', (text) => {
  expect(pasteAction(text, [])).toBeNull()
  expect(pasteAction(text, [pdf])).toBeNull()
})
