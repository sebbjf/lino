import { beforeEach, expect, test } from 'vitest'
import { useBoard } from './store.ts'

const at = { x: 0, y: 0 }
const board = () => useBoard.getState()
const ids = () => board().elements.map((e) => e.id)

beforeEach(() => useBoard.setState({ elements: [], past: [], future: [], selectedId: null }))

test('undo and redo discrete actions', () => {
  board().add({ type: 'note', text: 'a', w: 10, h: 10 }, at)
  board().add({ type: 'color', hex: '#000000', w: 10, h: 10 }, at)
  const [a, b] = ids()
  board().remove(a)
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
  expect(board().selectedId).toBe(id)
  board().undo()
  expect(board().selectedId).toBeNull()
  board().add({ type: 'note', text: '', w: 10, h: 10 }, at)
  expect(board().future).toEqual([])
})
