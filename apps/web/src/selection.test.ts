import { beforeEach, expect, test, vi } from 'vitest'
import { duplicate, nudge, remove, reorder, rotateStep, targetOf } from './selection.ts'
import { useBoard } from './store.ts'

const board = () => useBoard.getState()
const at = { x: 0, y: 0 }
let a: string, b: string, c: string

beforeEach(() => {
  useBoard.setState({ elements: [], past: [], future: [], selectedIds: [], readOnly: false })
  for (const text of ['a', 'b', 'c']) board().add({ type: 'note', text, w: 10, h: 10 }, at)
  ;[a, b, c] = board().elements.map((e) => e.id)
  board().selectMany([a, b])
})
const get = (id: string) => board().elements.find((e) => e.id === id)!

test('targetOf is the selection, or the one element it was aimed at when that is outside it', () => {
  expect(targetOf()).toEqual([a, b])
  expect(targetOf(a)).toEqual([a, b])
  expect(targetOf(c)).toEqual([c])
})

test('nudge moves only the target, as one undo step', () => {
  const before = [a, b, c].map((id) => get(id).x)
  nudge([a, b], 10, 0)
  expect([a, b, c].map((id) => get(id).x)).toEqual([before[0] + 10, before[1] + 10, before[2]])
  board().undo()
  expect([a, b, c].map((id) => get(id).x)).toEqual(before)
})

test('rotateStep turns each element 15° about its own centre, snaps to the 15° grid and wraps around', () => {
  useBoard.setState((s) => ({ elements: s.elements.map((e) => ({ ...e, rotation: e.id === a ? 165 : -180 })) }))
  rotateStep([a, b], 1)
  expect([get(a).rotation, get(b).rotation]).toEqual([-180, -165])
  rotateStep([a, b], -1)
  rotateStep([a, b], -1)
  expect([get(a).rotation, get(b).rotation]).toEqual([150, 165])
  useBoard.setState((s) => ({ elements: s.elements.map((e) => (e.id === a ? { ...e, rotation: 170 } : e)) }))
  rotateStep([a], 1)
  expect(get(a).rotation).toBe(-180) // an off-grid angle lands on the grid
})

test('remove and duplicate act on the target', () => {
  duplicate([a, b])
  expect(board().elements).toHaveLength(5)
  remove([a])
  expect(board().elements.map((e) => e.id)).not.toContain(a)
})

test('on a read-only board every command does nothing and leaves no history', () => {
  useBoard.setState({ readOnly: true })
  const { elements, past } = board()
  nudge([a], 1, 0)
  rotateStep([a], 1)
  duplicate([a])
  reorder(a, 'front')
  remove([a])
  expect(board().elements).toBe(elements)
  expect(board().past).toBe(past)
})

test('every command is exactly one undo step', () => {
  const steps = () => board().past.length
  const run = (command: () => void) => {
    const before = steps()
    const elements = board().elements
    command()
    expect(steps()).toBe(before + 1)
    board().undo()
    expect(board().elements).toBe(elements)
  }
  run(() => nudge([a, b], 1, 0))
  run(() => rotateStep([a, b], 1))
  run(() => duplicate([a, b]))
  run(() => remove([a, b]))
  run(() => reorder(a, 'front'))
})

test('a burst of nudges is one undo step, a pause starts a new one', () => {
  vi.useFakeTimers()
  try {
    const x0 = get(a).x
    nudge([a], 1, 0)
    vi.advanceTimersByTime(100)
    nudge([a], 1, 0)
    vi.advanceTimersByTime(100)
    nudge([a], 1, 0)
    vi.advanceTimersByTime(1000)
    nudge([a], 1, 0)
    board().undo()
    expect(get(a).x).toBe(x0 + 3)
    board().undo()
    expect(get(a).x).toBe(x0)
    nudge([b], 1, 0) // other elements never join an earlier burst
    nudge([a], 1, 0)
    board().undo()
    expect(get(a).x).toBe(x0)
  } finally {
    vi.useRealTimers()
  }
})
