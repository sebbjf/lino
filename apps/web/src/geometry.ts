export type Box = { x: number; y: number; w: number; h: number; rotation: number }

export const MIN_SIZE = 24

export function rotateVec(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Resize from the bottom-right corner by a world-space delta, keeping the top-left corner fixed in world space. */
export function resize(box: Box, dx: number, dy: number, keepAspect: boolean): Box {
  const local = rotateVec(dx, dy, -box.rotation)
  let w = Math.max(MIN_SIZE, box.w + local.x)
  let h = Math.max(MIN_SIZE, box.h + local.y)
  if (keepAspect) {
    const scale = Math.max(w / box.w, h / box.h, MIN_SIZE / Math.min(box.w, box.h))
    w = box.w * scale
    h = box.h * scale
  }
  const shift = rotateVec((w - box.w) / 2, (h - box.h) / 2, box.rotation)
  const cx = box.x + box.w / 2 + shift.x
  const cy = box.y + box.h / 2 + shift.y
  return { ...box, x: cx - w / 2, y: cy - h / 2, w, h }
}

/** Rotation (degrees, -180..180) that points the box's top edge at a world point. */
export function angleTo(box: Box, px: number, py: number, snap: boolean): number {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  if (snap) deg = Math.round(deg / 15) * 15
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

/** Zoom around a screen point so that point stays under the cursor. */
export function zoomAt(view: { x: number; y: number; zoom: number }, px: number, py: number, zoom: number) {
  const z = Math.min(4, Math.max(0.1, zoom))
  return { zoom: z, x: px - ((px - view.x) * z) / view.zoom, y: py - ((py - view.y) * z) / view.zoom }
}
