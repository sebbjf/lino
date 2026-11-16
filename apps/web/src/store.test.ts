import { beforeEach, expect, test, vi } from 'vitest'
import { useBoard } from './store.ts'

const at = { x: 0, y: 0 }
const board = () => useBoard.getState()
const ids = () => board().elements.map((e) => e.id)

beforeEach(() => useBoard.setState({ elements: [], past: [], future: [], selectedIds: [] }))

test('undo and redo discrete actions', () => {
  board().add({ type: 'note', text: 'a', w: 10, h: 10 }, at)
  board().add({ type: 'color', hex: '#000000', w: 10, h: 10 }, at)
  const [a, b] = ids()
  board().remove([a])
  expect(ids()).toEqual([b])
  board().undo()
  expect(ids()).toEqual([a, b])
  board().undo()
  expect(ids()).toEqual([a])
  board().redo()
  board().redo()
  expect(ids()).toEqual([b])
  board().redo() // nothing left: no-op
  expect(ids()).toEqual([b])
})

test('a gesture of many updates undoes as one step', () => {
  board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  const [id] = ids()
  board().checkpoint()
  for (let x = 1; x <= 50; x++) board().update(id, { x })
  expect(board().elements[0].x).toBe(50)
  board().undo()
  expect(board().elements[0].x).toBe(-5) // back to where add() centred it
})

test('a gesture that changed nothing leaves no empty undo step', () => {
  board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  board().checkpoint() // e.g. a click that selected without dragging
  board().checkpoint()
  board().undo()
  expect(ids()).toEqual([]) // undid the add, not an empty step
})

test('a new action clears redo, and undo drops a deleted selection', () => {
  board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  const [id] = ids()
  expect(board().selectedIds).toEqual([id])
  board().undo()
  expect(board().selectedIds).toEqual([])
  board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  expect(board().future).toEqual([])
})

test('toggle selection, group duplicate/remove and align as one undo step', () => {
  const a = board().add({ type: 'note', text: 'a', w: 10, h: 10 }, { x: 5, y: 5 })
  const b = board().add({ type: 'note', text: 'b', w: 10, h: 10 }, { x: 105, y: 45 })
  board().select(a)
  board().select(b, true)
  expect(board().selectedIds).toEqual([a, b])
  board().select(a, true)
  expect(board().selectedIds).toEqual([b])

  board().align([a, b], 'top')
  expect(board().elements.map((e) => e.y)).toEqual([0, 0])
  board().undo()
  expect(board().elements.map((e) => e.y)).toEqual([0, 40])

  board().duplicate([a, b])
  expect(board().elements).toHaveLength(4)
  board().remove(board().selectedIds)
  expect(ids()).toEqual([a, b])
})

test('restyle keeps note-only fields off other elements and keeps unmentioned ones', () => {
  board().add({ type: 'note', text: 'a', w: 10, h: 10 }, at)
  board().add({ type: 'color', hex: '#000000', w: 10, h: 10 }, at)
  const [n, c] = ids()
  board().checkpoint()
  board().restyle([n, c], { bg: '#fff3b0', corner: 'square' })
  board().restyle([n], { opacity: 0.5 })
  const [note, color] = board().elements
  expect(note).toMatchObject({ bg: '#fff3b0', corner: 'square', opacity: 0.5 })
  expect(color).toMatchObject({ corner: 'square' })
  expect(color).not.toHaveProperty('bg')
  board().undo()
  expect(board().elements[0]).not.toHaveProperty('corner')
})

test('copy and paste style resets what the source does not set', () => {
  board().add({ type: 'note', text: 'a', w: 10, h: 10 }, at)
  board().add({ type: 'note', text: 'b', w: 10, h: 10 }, at)
  const [a, b] = ids()
  board().restyle([a], { bg: '#fff3b0', corner: 'round' })
  board().restyle([b], { opacity: 0.5, size: 'lg' })
  board().copyStyle(a)
  board().pasteStyle([b])
  expect(board().elements[1]).toMatchObject({ bg: '#fff3b0', corner: 'round', opacity: undefined, size: undefined })
  board().undo()
  expect(board().elements[1]).toMatchObject({ opacity: 0.5, size: 'lg' })
})

test('messy mode tilts new elements a little', () => {
  useBoard.setState({ board: { messy: true } })
  for (let i = 0; i < 20; i++) board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  const tilts = board().elements.map((e) => e.rotation)
  expect(tilts.every((r) => Math.abs(r) <= 5)).toBe(true)
  expect(tilts.some((r) => r !== 0)).toBe(true)
  useBoard.setState({ board: {} })
})

test('arrange lays out only the given elements as one undo step', () => {
  board().add({ type: 'note', text: '', w: 100, h: 100 }, { x: 0, y: 0 })
  board().add({ type: 'note', text: '', w: 100, h: 100 }, { x: 10, y: 10 })
  board().add({ type: 'note', text: '', w: 100, h: 100 }, { x: 900, y: 900 })
  const [a, b] = ids()
  board().update(b, { rotation: 30 })
  const before = board().elements
  board().arrange([a, b], 'row')
  const [ea, eb, ec] = board().elements
  expect(eb).toMatchObject({ x: ea.x + 124, y: ea.y, rotation: 0 })
  expect(ec).toBe(before[2])
  board().undo()
  expect(board().elements).toBe(before)
})

test('fan stacks the hand left to right within the same layers', () => {
  for (const x of [500, 0, 900, 300]) board().add({ type: 'note', text: String(x), w: 100, h: 140 }, { x, y: 0 })
  board().add({ type: 'color', hex: '#000000', w: 10, h: 10 }, { x: 2000, y: 2000 })
  const notes = ids().slice(0, 4)
  board().arrange(notes, 'fan')
  const els = board().elements
  const xs = els.slice(0, 4).map((e) => e.x)
  expect(xs).toEqual([...xs].sort((a, b) => a - b))
  expect(els[4].type).toBe('color') // untouched element keeps its layer
})

test('adding twice without a position does not stack the second exactly on the first', () => {
  vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 }) // node has no window; add() centers on the viewport
  const el = { type: 'color', hex: '#000000', w: 10, h: 10 } as const
  board().add(el)
  board().add(el)
  const [a, b] = board().elements
  expect([b.x - a.x, b.y - a.y]).toEqual([24, 24])
  vi.unstubAllGlobals()
})

test('swatchRow lays swatches under an element, as wide as it, in one undo step', () => {
  const id = board().add({ type: 'image', src: '', w: 100, h: 50 }, { x: 50, y: 25 })
  board().swatchRow(id, ['#111111', '#222222', '#333333'])
  const row = board().elements.slice(1)
  expect(row.map((e) => [e.x, e.y, e.w])).toEqual([[0, 58, 28], [36, 58, 28], [72, 58, 28]])
  expect(row.at(-1)!.x + row.at(-1)!.w).toBe(100)
  expect(board().selectedIds).toEqual(row.map((e) => e.id))
  board().undo()
  expect(board().elements).toHaveLength(1)
})
