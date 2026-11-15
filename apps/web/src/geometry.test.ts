import { expect, test } from 'vitest'
import { angleTo, resize, rotateVec, zoomAt, fitView, boundsOf, snapMove, type Box } from './geometry.ts'

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
