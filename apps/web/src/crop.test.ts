import { expect, test } from 'vitest'
import { clampCrop, coverCrop, cropBox, dragCrop, FULL, MIN_CROP } from './crop.ts'

const box = { x: 100, y: 50, w: 200, h: 100, rotation: 0 }

test('clampCrop keeps the rect inside the source and above the minimum size', () => {
  expect(clampCrop({ x: 0.9, y: -1, w: 0.5, h: 0 })).toEqual({ x: 0.5, y: 0, w: 0.5, h: MIN_CROP })
})

test('coverCrop is what object-fit: cover shows', () => {
  expect(coverCrop(100, 100, 200, 100)).toEqual({ x: 0.25, y: 0, w: 0.5, h: 1 })
  expect(coverCrop(100, 50, 200, 100)).toEqual(FULL)
})

test('dragCrop moves named edges and clamps to the source and the minimum size', () => {
  const c = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }
  expect(Object.values(dragCrop(c, 'nw', -0.5, 0.1))).toEqual([0, 0.3, 0.7, 0.4].map((v) => expect.closeTo(v)))
  expect(dragCrop(c, 'e', 1, 0).w).toBeCloseTo(0.8)
  expect(dragCrop(c, 'e', -1, 0).w).toBeCloseTo(MIN_CROP)
})

test('cropBox keeps the scale: cropping the left half moves the box right edge in place', () => {
  const r = cropBox(box, FULL, { x: 0.5, y: 0, w: 0.5, h: 1 })
  expect(r).toEqual({ x: 200, y: 50, w: 100, h: 100 })
  // a flipped image shows its right half on the left: the box shrinks towards the right instead
  expect(cropBox(box, FULL, { x: 0.5, y: 0, w: 0.5, h: 1 }, { x: true })).toEqual({ x: 100, y: 50, w: 100, h: 100 })
})

test('cropBox follows the rotation and round-trips back to the original box', () => {
  const rot = { ...box, rotation: 90 }
  const to = { x: 0, y: 0.5, w: 1, h: 0.5 }
  const r = cropBox(rot, FULL, to)
  // the bottom half of a box turned 90deg clockwise ends up on its left side
  expect(r.w).toBe(200)
  expect(r.h).toBe(50)
  const back = cropBox({ ...r, rotation: 90 }, to, FULL)
  for (const k of ['x', 'y', 'w', 'h'] as const) expect(back[k]).toBeCloseTo(rot[k])
})
