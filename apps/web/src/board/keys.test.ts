import { expect, test } from 'vitest'
import { elementKey, type Keys } from './keys.ts'

const press = (key: string, more: Partial<Keys> = {}) => elementKey({ key, code: '', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...more })

test('arrows nudge by 1, or 10 with Shift; Alt+arrows resize instead', () => {
  expect(press('ArrowLeft')).toEqual({ do: 'nudge', dx: -1, dy: 0 })
  expect(press('ArrowDown', { shiftKey: true })).toEqual({ do: 'nudge', dx: 0, dy: 10 })
  expect(press('ArrowRight', { altKey: true })).toEqual({ do: 'resize', dx: 1, dy: 0 })
  expect(press('ArrowUp', { altKey: true, shiftKey: true })).toEqual({ do: 'resize', dx: 0, dy: -10 })
})

test('Ctrl/Cmd+Alt by key position copies or pastes the look, or frames the selection', () => {
  expect(press('©', { code: 'KeyC', altKey: true, ctrlKey: true })).toEqual({ do: 'copy-style' })
  expect(press('√', { code: 'KeyV', altKey: true, metaKey: true })).toEqual({ do: 'paste-style' })
  expect(press('ƒ', { code: 'KeyF', altKey: true, ctrlKey: true })).toEqual({ do: 'frame' })
  expect(press('c', { code: 'KeyC', altKey: true })).toBeNull()
})

test('letters need the modifier they promise and leave browser shortcuts alone', () => {
  expect(press('g', { ctrlKey: true })).toEqual({ do: 'group' })
  expect(press('G', { ctrlKey: true, shiftKey: true })).toEqual({ do: 'ungroup' })
  expect(press('g')).toBeNull()
  expect(press('d', { metaKey: true })).toEqual({ do: 'duplicate' })
  expect(press('d')).toBeNull()
  expect(press('r')).toEqual({ do: 'rotate', dir: 1 })
  expect(press('R', { shiftKey: true })).toEqual({ do: 'rotate', dir: -1 })
  expect(press('r', { ctrlKey: true })).toBeNull()
})

test('brackets reorder one step, or to the end with the modifier; Delete, Enter and Escape', () => {
  expect(press(']')).toEqual({ do: 'reorder', to: 'forward' })
  expect(press(']', { ctrlKey: true })).toEqual({ do: 'reorder', to: 'front' })
  expect(press('[')).toEqual({ do: 'reorder', to: 'backward' })
  expect(press('[', { metaKey: true })).toEqual({ do: 'reorder', to: 'back' })
  expect(press('Delete')).toEqual({ do: 'remove' })
  expect(press('Backspace')).toEqual({ do: 'remove' })
  expect(press('Enter')).toEqual({ do: 'open' })
  expect(press('Escape')).toEqual({ do: 'escape' })
  expect(press('x')).toBeNull()
})
