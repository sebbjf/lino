import { beforeEach, expect, test, vi } from 'vitest'
import { duplicate, frameSelection, group, nudge, remove, reorder, rotateStep, targetOf, toggleLock, ungroup } from './selection.ts'
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

test('a locked element is skipped by every command, and by align and restyle', () => {
  board().update(a, { locked: true })
  const before = { a: get(a).x, b: get(b).x }
  nudge([a, b], 10, 0)
  rotateStep([a, b], 1)
  remove([a])
  duplicate([a])
  expect([get(a).x, get(a).rotation, get(b).x, get(b).rotation]).toEqual([before.a, 0, before.b + 10, 15])
  expect(board().elements).toHaveLength(3)
  board().restyle([a, b], { corner: 'round' })
  expect([get(a).corner, get(b).corner]).toEqual([undefined, 'round'])
  board().update(b, { x: 500 })
  board().align([a, b, c], 'left')
  expect(get(a).x).toBe(before.a)
})

test('toggleLock locks the selection in one undo step, then unlocks it', () => {
  toggleLock([a, b])
  expect([get(a).locked, get(b).locked, get(c).locked]).toEqual([true, true, undefined])
  board().undo()
  expect([get(a).locked, get(b).locked]).toEqual([undefined, undefined])
  board().redo()
  toggleLock([a, c]) // not all locked: locks the rest
  expect(get(c).locked).toBe(true)
  toggleLock([a, b, c])
  expect([a, b, c].map((id) => get(id).locked)).toEqual([undefined, undefined, undefined])
  board().selectMany([a, b, c]) // a locked element can still be selected
  expect(board().selectedIds).toHaveLength(3)
})

test('a read-only board cannot be locked', () => {
  useBoard.setState({ readOnly: true })
  toggleLock([a])
  expect(get(a).locked).toBeUndefined()
})

test('group and ungroup are one undo step each and respect locks', () => {
  group([a, b])
  expect(get(a).groupId).toBeTruthy()
  expect(get(a).groupId).toBe(get(b).groupId)
  expect(get(c).groupId).toBeUndefined()
  board().select(null)
  board().select(b)
  expect(board().selectedIds).toEqual([a, b]) // clicking one member picks the group
  ungroup([a, b])
  expect(get(a).groupId).toBeUndefined()
  board().undo()
  expect(get(a).groupId).toBeTruthy()
  board().undo()
  expect(get(a).groupId).toBeUndefined()
  toggleLock([a])
  group([a, b, c])
  expect(get(a).groupId).toBeUndefined() // locked: untouched
  expect(get(b).groupId).toBe(get(c).groupId)
  group([c])
  expect(get(c).groupId).toBe(get(b).groupId) // fewer than two: no-op
})

test('duplicating a group makes a group of its own', () => {
  group([a, b])
  duplicate([a, b])
  const [x, y] = board().selectedIds.map(get)
  expect(x.groupId).toBeTruthy()
  expect(x.groupId).toBe(y.groupId)
  expect(x.groupId).not.toBe(get(a).groupId)
})

test('frameSelection adds a padded frame around the selection, selected', () => {
  frameSelection([a, b])
  const f = board().elements.at(-1)!
  expect(f.type).toBe('frame')
  expect(board().selectedIds).toEqual([f.id])
  expect(f).toMatchObject({ x: -32 - 5, w: 10 + 64 })
})

test('arranging a lone frame lays out its contents inside it', () => {
  useBoard.setState({ elements: [], past: [], future: [], selectedIds: [] })
  const f = board().add({ type: 'frame', title: 'f', w: 400, h: 300 }, { x: 200, y: 150 })
  const ids = [50, 300].map((x) => board().add({ type: 'note', text: 'n', w: 40, h: 40 }, { x, y: 100 }))
  const outside = board().add({ type: 'note', text: 'o', w: 40, h: 40 }, { x: 900, y: 100 })
  board().arrange([f], 'column')
  const [p, q] = ids.map(get)
  expect(Math.abs(p.x - q.x)).toBeLessThan(1) // a column
  expect(p.y).not.toBe(q.y)
  expect(get(outside).x).toBe(880)
  expect(get(f)).toMatchObject({ x: 0, y: 0, w: 400, h: 300 })
})
