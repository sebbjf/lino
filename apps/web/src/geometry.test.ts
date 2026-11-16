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
  // fan, collage and mosaic overlap on purpose
  const tidy = LAYOUTS.filter((m) => m !== 'fan' && m !== 'collage' && m !== 'mosaic')
  const big = Array.from({ length: 40 }, (_, i) => box(i * 37, i * 11, 60 + (i % 5) * 40, 50 + (i % 3) * 60))
  for (const set of [boxes, mixed, big]) for (const mode of tidy) {
    const placed = layoutPositions(set, mode).map((p, i) => ({ ...set[i], ...p }))
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlaps(placed[i], placed[j]), `${mode} ${i}-${j}`).toBe(false)
    expect(placed.every((p) => p.rotation === 0)).toBe(true)
  }
  // reading order: the top-left box comes first in a row
  const row = layoutPositions(boxes, 'row')
  expect(row[1]).toEqual({ x: 0, y: 40, rotation: 0 }) // centered in the 200px-tall line: (200 - 120) / 2
  expect(row[0].x).toBe(200 + 24)
})

test('sunflower puts the biggest box in the middle', () => {
  const boxes = [box(0, 0, 50, 50), box(100, 0, 300, 200), box(500, 0, 60, 40), box(0, 300, 80, 80)]
  const b = boundsOf(boxes)
  const p = layoutPositions(boxes, 'sunflower')[1]
  expect(p.x + 150).toBeCloseTo(b.x + b.w / 2)
  expect(p.y + 100).toBeCloseTo(b.y + b.h / 2)
  // packs about as tight as a grid, not spread out by the biggest pair
  const mixed = [box(0, 0, 200, 120), box(0, 0, 200, 120), ...Array.from({ length: 6 }, (_, i) => box(i * 300, 500, 90, 90))]
  const area = (mode: 'grid' | 'sunflower') => {
    const r = boundsOf(layoutPositions(mixed, mode).map((q, i) => ({ ...mixed[i], ...q })))
    return r.w * r.h
  }
  expect(area('sunflower')).toBeLessThan(area('grid') * 1.6)
})

test('fan tilts cards symmetrically, left to right, the middle one highest', () => {
  const boxes = Array.from({ length: 5 }, (_, i) => box(i * 200, 0, 120, 160))
  const fan = layoutPositions(boxes, 'fan')
  const rot = fan.map((p) => p.rotation)
  expect(rot[2]).toBe(0)
  for (let k = 0; k < 5; k++) expect(rot[k]).toBeCloseTo(-rot[4 - k])
  expect(rot).toEqual([...rot].sort((x, y) => x - y))
  expect(fan[0].x).toBeLessThan(fan[4].x)
  expect(fan[0].y).toBeCloseTo(fan[4].y) // symmetric
  expect(fan[2].y).toBeLessThan(fan[0].y) // the middle card is highest
  for (let k = 0; k < 4; k++) expect(fan[k + 1].x - fan[k].x).toBeGreaterThan(0)
})

test('collage is tilted a little and the same every time', () => {
  const boxes = Array.from({ length: 6 }, (_, i) => box(i * 150, 0, 120, 120))
  const a = layoutPositions(boxes, 'collage')
  expect(layoutPositions(boxes, 'collage')).toEqual(a)
  expect(a.every((p) => Math.abs(p.rotation) <= 6)).toBe(true)
  expect(a.some((p) => p.rotation !== 0)).toBe(true)
})

test('mosaic overlaps flat pieces in staggered rows and is the same every time', () => {
  const boxes = Array.from({ length: 8 }, (_, i) => box(i * 150, 0, 120, 160))
  const a = layoutPositions(boxes, 'mosaic')
  expect(layoutPositions(boxes, 'mosaic')).toEqual(a)
  expect(a.every((p) => p.rotation === 0)).toBe(true)
  const placed = a.map((p, i) => ({ ...boxes[i], ...p }))
  expect(placed.some((p, i) => placed.some((q, j) => i < j && overlaps(p, q)))).toBe(true)
})
