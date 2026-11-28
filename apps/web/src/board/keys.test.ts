import { beforeEach, describe, expect, test } from 'vitest'
import { elementKey, runElementKey, type ElementKey, type Keys } from './keys.ts'
import { useBoard } from './store.ts'

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

describe('runElementKey', () => {
  const board = () => useBoard.getState()
  const elements = () => board().elements
  const run = (action: ElementKey, focused = elements()[0]) => runElementKey(action, focused)

  beforeEach(() => {
    useBoard.setState({ elements: [], past: [], future: [], selectedIds: [], board: {}, readOnly: false })
    for (const x of [50, 150, 250]) board().add({ type: 'note', text: String(x), w: 100, h: 50 }, { x, y: 25 })
    board().selectMany(elements().slice(0, 2).map((el) => el.id))
  })

  test('resizes only the focused image in its local axes and checkpoints the change', () => {
    const [a, b, c] = elements()
    board().update(a.id, { type: 'image', src: '', rotation: 90 })
    const before = elements()
    expect(run({ do: 'resize', dx: 20, dy: 0 })).toBe(true)
    const [image, ...others] = elements()
    expect(image).toMatchObject({ id: a.id, x: -15, y: 5, w: 120, h: 60, rotation: 90 })
    expect(others).toEqual([b, c])
    board().undo()
    expect(elements()).toEqual(before)
  })

  test('nudges the selection by the given delta and falls back to the focused element', () => {
    expect(run({ do: 'nudge', dx: 10, dy: -1 })).toBe(true)
    expect(elements().map(({ x, y }) => [x, y])).toEqual([[10, -1], [110, -1], [200, 0]])
    expect(run({ do: 'nudge', dx: -1, dy: 10 }, elements()[2])).toBe(true)
    expect(elements().map(({ x, y }) => [x, y])).toEqual([[10, -1], [110, -1], [199, 10]])
  })

  test('copies style from the focused element and pastes it onto the selection', () => {
    const [a, b, c] = elements()
    board().restyle([a.id], { corner: 'square' })
    board().restyle([b.id], { corner: 'round' })
    board().restyle([c.id], { corner: 'soft' })
    expect(run({ do: 'copy-style' }, elements()[1])).toBe(true)
    board().restyle([b.id], { corner: 'square' })
    expect(run({ do: 'paste-style' })).toBe(true)
    expect(elements().map((el) => el.corner)).toEqual(['round', 'round', 'soft'])
  })

  test('frames the selected bounds', () => {
    expect(run({ do: 'frame' })).toBe(true)
    expect(elements()).toHaveLength(4)
    expect(elements().at(-1)).toMatchObject({ type: 'frame', x: -32, y: -32, w: 264, h: 114 })
  })

  test('groups and ungroups the selection', () => {
    expect(run({ do: 'group' })).toBe(true)
    const [a, b, c] = elements()
    expect(a.groupId).toBeTruthy()
    expect(b.groupId).toBe(a.groupId)
    expect(c.groupId).toBeUndefined()
    expect(run({ do: 'ungroup' })).toBe(true)
    expect(elements().map((el) => el.groupId)).toEqual([undefined, undefined, undefined])
  })

  test('duplicates the selection', () => {
    const [a, b, c] = elements()
    expect(run({ do: 'duplicate' })).toBe(true)
    expect(elements().slice(0, 3)).toEqual([a, b, c])
    const copies = elements().slice(3)
    expect(copies.map((el) => 'text' in el && el.text)).toEqual(['50', '150'])
    expect(board().selectedIds).toEqual(copies.map((el) => el.id))
  })

  test('removes the selection', () => {
    const c = elements()[2]
    expect(run({ do: 'remove' })).toBe(true)
    expect(elements()).toEqual([c])
  })

  test('rotates the selection in the given direction', () => {
    expect(run({ do: 'rotate', dir: -1 })).toBe(true)
    expect(elements().map((el) => el.rotation)).toEqual([-15, -15, 0])
  })

  test('reorders only the focused element to the given layer', () => {
    const [a, b, c] = elements()
    expect(run({ do: 'reorder', to: 'front' })).toBe(true)
    expect(elements()).toEqual([b, c, a])
  })

  test.each(['open', 'escape'] as const)('leaves %s to the component', (action) => {
    expect(run({ do: action })).toBe(false)
  })
})
