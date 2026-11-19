import { expect, test } from 'vitest'
import { expandGroups, frameAround, frameContents, layoutInFrame } from './frames.ts'
import { boundsOf } from './geometry.ts'

const b = (id: string, x: number, y: number, w = 10, h = 10) => ({ id, x, y, w, h, rotation: 0 })

test('frameContents picks elements whose centre is inside, not the frame itself', () => {
  const frame = b('f', 0, 0, 100, 100)
  const els = [frame, b('in', 10, 10), b('edge', 95, 95), b('out', 120, 10), b('big', -50, -50, 120, 120)]
  expect(frameContents(frame, els).map((e) => e.id)).toEqual(['in', 'edge', 'big'])
})

test('frameAround pads the bounds', () => {
  expect(frameAround([b('a', 0, 0), b('b', 100, 50)], 10)).toEqual({ x: -10, y: -10, w: 130, h: 80 })
})

test('expandGroups adds the whole group, leaves ungrouped ids alone', () => {
  const els = [{ id: 'a', groupId: 'g' }, { id: 'b', groupId: 'g' }, { id: 'c' }, { id: 'd', groupId: 'h' }]
  expect(expandGroups(['a'], els)).toEqual(['a', 'b'])
  expect(expandGroups(['c'], els)).toEqual(['c'])
  expect(expandGroups(['b', 'd'], els)).toEqual(['a', 'b', 'd'])
})

test('layoutInFrame keeps the layout inside the frame, growing it when needed', () => {
  const boxes = [b('a', 500, 500, 100, 100), b('b', 700, 500, 100, 100)]
  const r = layoutInFrame(b('f', 0, 0, 400, 300), boxes, 'row')
  const nb = boundsOf(boxes.map((o, i) => ({ ...o, ...r.placed[i] })))
  expect(nb.x).toBeGreaterThanOrEqual(0)
  expect(nb.x + nb.w).toBeLessThanOrEqual(r.size.w)
  expect(nb.y + nb.h).toBeLessThanOrEqual(r.size.h)
  expect(layoutInFrame(b('f', 0, 0, 100, 100), boxes, 'row').size.w).toBeGreaterThan(100)
})
