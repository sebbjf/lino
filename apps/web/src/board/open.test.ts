import { expect, test } from 'vitest'
import { openAction } from './open.ts'
import type { BoardElement } from './store.ts'

const box = { id: 'element', x: 0, y: 0, w: 100, h: 50, rotation: 0 }
const image = { ...box, type: 'image', src: '/image.png' } satisfies BoardElement
const note = { ...box, type: 'note', text: 'Note' } satisfies BoardElement
const frame = { ...box, type: 'frame', title: 'Frame' } satisfies BoardElement
const color = { ...box, type: 'color', hex: '#123456' } satisfies BoardElement
const link = {
  ...box, type: 'link', url: 'https://example.com', title: null, image: null,
  fonts: [], colors: [], missing: [], status: 'ok',
} satisfies BoardElement

test('opens cropping for an editable image', () => {
  expect(openAction(image, false)).toEqual({ kind: 'crop' })
})

test('opens editing for editable notes and frames', () => {
  expect(openAction(note, false)).toEqual({ kind: 'edit' })
  expect(openAction(frame, false)).toEqual({ kind: 'edit' })
})

test('opens the picker for an editable color', () => {
  expect(openAction(color, false)).toEqual({ kind: 'picker' })
})

test('does nothing for read-only or locked non-links', () => {
  for (const el of [image, note, frame, color]) {
    expect(openAction(el, true)).toEqual({ kind: 'none' })
    expect(openAction({ ...el, locked: true }, false)).toEqual({ kind: 'none' })
  }
})

test('opens links on editable and read-only boards, even when locked', () => {
  const action = { kind: 'url', url: link.url }
  expect(openAction(link, false)).toEqual(action)
  expect(openAction(link, true)).toEqual(action)
  expect(openAction({ ...link, locked: true }, false)).toEqual(action)
  expect(openAction({ ...link, locked: true }, true)).toEqual(action)
})
