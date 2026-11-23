import { rotateVec } from './geometry.ts'

/** The visible part of an image, as fractions (0-1) of the source. */
export type Crop = { x: number; y: number; w: number; h: number }
export const FULL: Crop = { x: 0, y: 0, w: 1, h: 1 }
/** Smallest crop side, as a fraction of the source. */
export const MIN_CROP = 0.05

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Forces a rect inside the source with at least MIN_CROP on each side (for untrusted input). */
export function clampCrop(c: Crop): Crop {
  const w = clamp(c.w, MIN_CROP, 1)
  const h = clamp(c.h, MIN_CROP, 1)
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h }
}

/** The part of an iw×ih source that `object-fit: cover` shows in a w×h box. */
export function coverCrop(w: number, h: number, iw: number, ih: number): Crop {
  const s = Math.max(w / iw, h / ih)
  const cw = w / s / iw
  const ch = h / s / ih
  return { x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch }
}

/** Moves the edges named in `edge` ('n', 'se', ...) by fractions dx, dy, keeping the rect inside the source and above MIN_CROP. */
export function dragCrop(c: Crop, edge: string, dx: number, dy: number): Crop {
  let [x0, y0, x1, y1] = [c.x, c.y, c.x + c.w, c.y + c.h]
  if (edge.includes('w')) x0 = clamp(x0 + dx, 0, x1 - MIN_CROP)
  if (edge.includes('e')) x1 = clamp(x1 + dx, x0 + MIN_CROP, 1)
  if (edge.includes('n')) y0 = clamp(y0 + dy, 0, y1 - MIN_CROP)
  if (edge.includes('s')) y1 = clamp(y1 + dy, y0 + MIN_CROP, 1)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * The element box after changing the crop from `from` to `to`, keeping the on-screen scale: what stays visible stays where it was.
 * Flips mirror the picture, so an offset along a flipped axis runs the other way on screen.
 */
export function cropBox(box: { x: number; y: number; w: number; h: number; rotation: number }, from: Crop, to: Crop, flip: { x?: boolean; y?: boolean } = {}) {
  const sx = box.w / from.w
  const sy = box.h / from.h
  const w = to.w * sx
  const h = to.h * sy
  const dx = (to.x + to.w / 2 - from.x - from.w / 2) * sx * (flip.x ? -1 : 1)
  const dy = (to.y + to.h / 2 - from.y - from.h / 2) * sy * (flip.y ? -1 : 1)
  const d = rotateVec(dx, dy, box.rotation)
  return { x: box.x + box.w / 2 + d.x - w / 2, y: box.y + box.h / 2 + d.y - h / 2, w, h }
}

/** CSS that shows only `c` of an image inside an overflow-hidden parent. */
export const cropStyle = (c: Crop) => ({
  position: 'absolute' as const,
  maxWidth: 'none',
  objectFit: 'fill' as const,
  width: `${100 / c.w}%`,
  height: `${100 / c.h}%`,
  left: `${(-c.x / c.w) * 100}%`,
  top: `${(-c.y / c.h) * 100}%`,
})
