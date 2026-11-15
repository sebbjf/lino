import { expect, test } from 'vitest'
import { angleTo, resize, rotateVec, zoomAt, fitView, boundsOf, snapMove, alignOffsets, distributeOffsets, layoutPositions, LAYOUTS, type Box } from './geometry.ts'

// world position of the box's local top-left corner
function topLeft(b: Box) {
  const v = rotateVec(-b.w / 2, -b.h / 2, b.rotation)
  return { x: b.x + b.w / 2 + v.x, y: b.y + b.h / 2 + v.y }
}

test('resize keeps the opposite corner fixed at any rotation', () => {
  for (const rotation of [0, 30, 90, -135]) {
    const box = { x: 10, y: 20, w: 100, h: 50, rotation }
    const out = resize(box, 40, -15, false)
    expect(topLeft(out).x).toBeCloseTo(topLeft(box).x)
    expect(topLeft(out).y).toBeCloseTo(topLeft(box).y)
  }
})

test('resize unrotated grows by the delta and respects min size', () => {
  expect(resize({ x: 0, y: 0, w: 100, h: 50, rotation: 0 }, 20, 10, false)).toMatchObject({ x: 0, y: 0, w: 120, h: 60 })
  expect(resize({ x: 0, y: 0, w: 100, h: 50, rotation: 0 }, -500, -500, false)).toMatchObject({ w: 24, h: 24 })
})

test('resize with keepAspect preserves ratio', () => {
  const out = resize({ x: 0, y: 0, w: 200, h: 100, rotation: 0 }, 100, 0, true)
  expect(out.w / out.h).toBeCloseTo(2)
  expect(out.w).toBeCloseTo(300)
  expect(resize({ x: 0, y: 0, w: 200, h: 100, rotation: 0 }, -1000, -1000, true).h).toBeCloseTo(24)
})

test('angleTo points top edge at the cursor, with snapping', () => {
  const box = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
  expect(angleTo(box, 50, -100, false)).toBeCloseTo(0)
  expect(angleTo(box, 200, 50, false)).toBeCloseTo(90)
  expect(angleTo(box, 50, 200, false)).toBeCloseTo(-180)
  expect(angleTo(box, 200, 40, true)).toBe(90)
})

test('angleTo pulls to right angles unless free', () => {
  const box = { x: 0, y: 0, w: 100, h: 100, rotation: 0 }
  // cursor ~4° past 90° (right side, slightly below center)
  expect(angleTo(box, 200, 60, false)).toBe(90)
  expect(angleTo(box, 200, 60, false, true)).toBeCloseTo(93.8, 0)
  expect(angleTo(box, 45, 200, false)).toBe(-180)
  // ~18° off: no pull
  expect(angleTo(box, 200, 100, false)).toBeCloseTo(108.4, 0)
})

test('zoomAt keeps the point under the cursor', () => {
  const v = { x: 30, y: -10, zoom: 1 }
  const out = zoomAt(v, 200, 100, 2)
  expect((200 - out.x) / out.zoom).toBeCloseTo((200 - v.x) / v.zoom)
  expect((100 - out.y) / out.zoom).toBeCloseTo((100 - v.y) / v.zoom)
  expect(zoomAt(v, 0, 0, 100).zoom).toBe(4)
})

test('fitView centers content and only zooms out', () => {
  const small = fitView([{ x: 100, y: 100, w: 200, h: 100, rotation: 0 }], 1000, 800)
  expect(small).toEqual({ zoom: 1, x: 300, y: 250 })
  const big = fitView([{ x: 0, y: 0, w: 1000, h: 100, rotation: 0 }, { x: 0, y: 0, w: 10, h: 10, rotation: 0 }], 600, 600, 50)
  expect(big.zoom).toBe(0.5)
  expect(big.x).toBe(50)
})

test('boundsOf includes rotated corners', () => {
  expect(boundsOf([{ x: 0, y: 0, w: 100, h: 50, rotation: 0 }, { x: 200, y: 200, w: 10, h: 10, rotation: 0 }])).toEqual({ x: 0, y: 0, w: 210, h: 210 })
  const r = boundsOf([{ x: 0, y: 0, w: 100, h: 100, rotation: 45 }])
  expect(r.w).toBeCloseTo(100 * Math.SQRT2)
  expect(r.x).toBeCloseTo(50 - 50 * Math.SQRT2)
})

test('snapMove pulls edges and centers within threshold and reports guides', () => {
  const other = { x: 100, y: 100, w: 100, h: 100 }
  // left edge 3px right of the other's left edge, far vertically: snaps x only
  const a = snapMove({ x: 103, y: 400, w: 50, h: 50 }, [other], 6)
  expect(a).toMatchObject({ dx: -3, dy: 0 })
  // after snapping, its right edge (150) also meets the other's center
  expect(a.guides).toEqual([
    { axis: 'x', pos: 100, from: 100, to: 450 },
    { axis: 'x', pos: 150, from: 100, to: 450 },
  ])
  // centers line up (150) after snapping y
  const b = snapMove({ x: 400, y: 128, w: 40, h: 40 }, [other], 6)
  expect(b.dy).toBe(2)
  expect(b.guides.map((g) => [g.axis, g.pos])).toEqual([['y', 150]])
  // out of range: nothing
  expect(snapMove({ x: 300, y: 300, w: 10, h: 10 }, [other], 6)).toEqual({ dx: 0, dy: 0, guides: [] })
})

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0 })

test('alignOffsets lines up edges and centers of the selection', () => {
  const boxes = [box(0, 0, 10, 10), box(50, 20, 30, 10)]
  expect(alignOffsets(boxes, 'left')).toEqual([{ dx: 0, dy: 0 }, { dx: -50, dy: 0 }])
  expect(alignOffsets(boxes, 'right')).toEqual([{ dx: 70, dy: 0 }, { dx: 0, dy: 0 }])
  expect(alignOffsets(boxes, 'vcenter')).toEqual([{ dx: 0, dy: 10 }, { dx: 0, dy: -10 }])
})

test('distributeOffsets spaces boxes evenly between the outer two', () => {
  // gaps 0..10 | 12..22 | 90..100 → total 100, sizes 30, gap 35
  const boxes = [box(90, 0, 10, 10), box(0, 0, 10, 10), box(12, 0, 10, 10)]
  expect(distributeOffsets(boxes, 'x').map((o) => o.dx)).toEqual([0, 0, 33])
})

const overlaps = (a: Box, c: Box) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h

test('layoutPositions arranges without overlaps and starts at the bounds', () => {
  const boxes = [box(300, 0, 100, 80), box(0, 0, 200, 120), box(50, 400, 120, 60), box(500, 300, 80, 200), box(10, 200, 140, 140)]
  // what the board in the browser showed overlapping in a circle: two wide images among small swatches
  const mixed = [box(0, 0, 200, 120), box(0, 0, 200, 120), ...Array.from({ length: 6 }, (_, i) => box(i * 300, 500, 90, 90))]
  for (const set of [boxes, mixed]) for (const mode of LAYOUTS) {
    const placed = layoutPositions(set, mode).map((p, i) => ({ ...set[i], ...p }))
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j]), `${mode} ${i}-${j}`).toBe(false)
  }
  for (const mode of LAYOUTS) {
    const placed = layoutPositions(boxes, mode).map((p, i) => ({ ...boxes[i], ...p }))
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j]), `${mode} ${i}-${j}`).toBe(false)
  }
  // reading order: the top-left box comes first in a row
  const row = layoutPositions(boxes, 'row')
  expect(row[1]).toEqual({ x: 0, y: 40 }) // centered in the 200px-tall line: (200 - 120) / 2
  expect(row[0].x).toBe(200 + 24)
})
