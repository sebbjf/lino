import { expect, test } from 'vitest'
import { moveTo, planMove } from './move.ts'
import type { BoardElement } from './store.ts'

const note = (id: string, x: number, y: number, more: Partial<BoardElement> = {}) =>
  ({ id, type: 'note', text: '', x, y, w: 100, h: 50, rotation: 0, ...more }) as BoardElement

test('a moved element follows the delta and snaps to a neighbour edge within the distance', () => {
  const els = [note('a', 0, 0), note('b', 300, 0)]
  const plan = planMove(['a'], els)
  expect(moveTo(plan, 10, 7, 0)).toEqual({ pos: { a: { x: 10, y: 7 } }, guides: [] })
  const snapped = moveTo(plan, 197, 0, 6) // right edge 297 lands on b's left edge 300
  expect(snapped.pos.a).toEqual({ x: 200, y: 0 })
  expect(snapped.guides.length).toBeGreaterThan(0)
})

test('a frame carries what lies inside it, but not locked elements or their groups', () => {
  const frame = { id: 'f', type: 'frame', title: '', x: 0, y: 0, w: 500, h: 400, rotation: 0 } as BoardElement
  const els = [frame, note('in', 50, 50), note('lock', 200, 50, { locked: true, groupId: 'g' }), note('mate', 300, 50, { groupId: 'g' }), note('out', 800, 0)]
  const plan = planMove(['f'], els)
  expect(Object.keys(moveTo(plan, 5, 5, 0).pos).sort()).toEqual(['f', 'in'])
})

test('nothing to move when only locked elements are picked', () => {
  expect(planMove(['a'], [note('a', 0, 0, { locked: true })]).moving).toEqual([])
})
