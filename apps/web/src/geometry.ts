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

/** Rotation (degrees, -180..180) that points the box's top edge at a world point.
 * snap: steps of 15°. Otherwise right angles pull within 6°, unless free. */
export function angleTo(box: Box, px: number, py: number, snap: boolean, free = false): number {
  const cx = box.x + box.w / 2
  const cy = box.y + box.h / 2
  let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI + 90
  if (snap) deg = Math.round(deg / 15) * 15
  else if (!free && Math.abs(deg - Math.round(deg / 90) * 90) < 6) deg = Math.round(deg / 90) * 90
  return ((((deg + 180) % 360) + 360) % 360) - 180
}

/** Zoom around a screen point so that point stays under the cursor. */
export function zoomAt(view: { x: number; y: number; zoom: number }, px: number, py: number, zoom: number) {
  const z = Math.min(4, Math.max(0.1, zoom))
  return { zoom: z, x: px - ((px - view.x) * z) / view.zoom, y: py - ((py - view.y) * z) / view.zoom }
}

/** View that fits all boxes in a w×h screen with padding, never zooming in past 100%. Rotation is ignored. */
export function fitView(boxes: Box[], w: number, h: number, pad = 64) {
  if (!boxes.length) return { x: 0, y: 0, zoom: 1 }
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const bw = Math.max(...boxes.map((b) => b.x + b.w)) - minX
  const bh = Math.max(...boxes.map((b) => b.y + b.h)) - minY
  const zoom = Math.max(0.1, Math.min(1, (w - pad * 2) / bw, (h - pad * 2) / bh))
  return { zoom, x: (w - bw * zoom) / 2 - minX * zoom, y: (h - bh * zoom) / 2 - minY * zoom }
}

/** World-space bounding box of boxes, rotation included. */
export function boundsOf(boxes: Box[]) {
  const pts = boxes.flatMap((b) =>
    [
      [-b.w / 2, -b.h / 2],
      [b.w / 2, -b.h / 2],
      [b.w / 2, b.h / 2],
      [-b.w / 2, b.h / 2],
    ].map(([x, y]) => {
      const p = rotateVec(x, y, b.rotation)
      return { x: p.x + b.x + b.w / 2, y: p.y + b.y + b.h / 2 }
    }),
  )
  const minX = Math.min(...pts.map((p) => p.x))
  const minY = Math.min(...pts.map((p) => p.y))
  return { x: minX, y: minY, w: Math.max(...pts.map((p) => p.x)) - minX, h: Math.max(...pts.map((p) => p.y)) - minY }
}

type Rect = { x: number; y: number; w: number; h: number }
/** A guide line in world space: vertical at x = pos (axis 'x') or horizontal at y = pos, spanning from..to. */
export type Guide = { axis: 'x' | 'y'; pos: number; from: number; to: number }

const edges = (start: number, size: number) => [start, start + size / 2, start + size]

/**
 * Snaps a moving rect to the edges and centers of other rects when within `threshold`.
 * Returns the correction to apply and the guides to draw for every line that now matches.
 */
export function snapMove(moving: Rect, others: Rect[], threshold: number) {
  const offset = (k: 'x' | 'y') => {
    const size = k === 'x' ? 'w' : 'h'
    let best: number | undefined
    for (const o of others)
      for (const m of edges(moving[k], moving[size]))
        for (const t of edges(o[k], o[size])) {
          const d = t - m
          if (Math.abs(d) <= threshold && (best === undefined || Math.abs(d) < Math.abs(best))) best = d
        }
    return best ?? 0
  }
  const dx = offset('x')
  const dy = offset('y')
  const r = { ...moving, x: moving.x + dx, y: moving.y + dy }

  const guides: Guide[] = []
  for (const [k, size, cross, crossSize] of [
    ['x', 'w', 'y', 'h'],
    ['y', 'h', 'x', 'w'],
  ] as const) {
    for (const o of others)
      for (const m of edges(r[k], r[size]))
        if (edges(o[k], o[size]).some((t) => Math.abs(t - m) < 0.5))
          guides.push({
            axis: k,
            pos: m,
            from: Math.min(r[cross], o[cross]),
            to: Math.max(r[cross] + r[crossSize], o[cross] + o[crossSize]),
          })
  }
  return { dx, dy, guides }
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'

/** Offsets that align boxes' visible outlines to the selection's edge or center, in input order. */
export function alignOffsets(boxes: Box[], mode: AlignMode) {
  const all = boundsOf(boxes)
  return boxes.map((b) => {
    const r = boundsOf([b])
    switch (mode) {
      case 'left':
        return { dx: all.x - r.x, dy: 0 }
      case 'hcenter':
        return { dx: all.x + all.w / 2 - (r.x + r.w / 2), dy: 0 }
      case 'right':
        return { dx: all.x + all.w - (r.x + r.w), dy: 0 }
      case 'top':
        return { dx: 0, dy: all.y - r.y }
      case 'vcenter':
        return { dx: 0, dy: all.y + all.h / 2 - (r.y + r.h / 2) }
      case 'bottom':
        return { dx: 0, dy: all.y + all.h - (r.y + r.h) }
    }
  })
}

/** Offsets that space boxes evenly along an axis, keeping the first and last in place. */
export function distributeOffsets(boxes: Box[], axis: 'x' | 'y') {
  const size = axis === 'x' ? 'w' : 'h'
  const rects = boxes.map((b, i) => ({ i, r: boundsOf([b]) })).sort((a, b) => a.r[axis] - b.r[axis])
  const first = rects[0].r
  const end = Math.max(...rects.map(({ r }) => r[axis] + r[size]))
  const gap = (end - first[axis] - rects.reduce((sum, { r }) => sum + r[size], 0)) / (rects.length - 1)
  const out = boxes.map(() => ({ dx: 0, dy: 0 }))
  let at = first[axis]
  for (const { i, r } of rects) {
    out[i] = axis === 'x' ? { dx: at - r.x, dy: 0 } : { dx: 0, dy: at - r.y }
    at += r[size] + gap
  }
  return out
}

export type Layout = 'grid' | 'masonry' | 'row' | 'column' | 'circle'
export const LAYOUTS: Layout[] = ['grid', 'masonry', 'row', 'column', 'circle']

/**
 * New top-left positions that arrange boxes into a template, keeping their sizes; rotation goes to 0.
 * Boxes are taken in reading order (top to bottom, then left to right) and the layout starts at
 * their current bounds' top-left (the circle keeps their center). Returned in input order.
 */
export function layoutPositions(boxes: Box[], mode: Layout, gap = 24): { x: number; y: number }[] {
  const n = boxes.length
  if (!n) return []
  const b = boundsOf(boxes)
  // rows are bands of 40px so slightly uneven tops still read left to right
  const order = boxes.map((_, i) => i).sort((i, j) => Math.round(boxes[i].y / 40) - Math.round(boxes[j].y / 40) || boxes[i].x - boxes[j].x)
  const out: { x: number; y: number }[] = new Array(n)
  const maxW = Math.max(...boxes.map((o) => o.w))
  const cols = Math.ceil(Math.sqrt(n))

  if (mode === 'row' || mode === 'column') {
    const along = mode === 'row' ? 'w' : 'h'
    const cross = mode === 'row' ? 'h' : 'w'
    const size = Math.max(...boxes.map((o) => o[cross]))
    let at = 0
    for (const i of order) {
      const o = boxes[i]
      const off = (size - o[cross]) / 2 // centered on the line
      out[i] = mode === 'row' ? { x: b.x + at, y: b.y + off } : { x: b.x + off, y: b.y + at }
      at += o[along] + gap
    }
  } else if (mode === 'grid') {
    // cells as wide as the widest box; each row as tall as its tallest box
    let y = b.y
    for (let r = 0; r * cols < n; r++) {
      const row = order.slice(r * cols, (r + 1) * cols)
      const rowH = Math.max(...row.map((i) => boxes[i].h))
      row.forEach((i, c) => {
        out[i] = { x: b.x + c * (maxW + gap) + (maxW - boxes[i].w) / 2, y: y + (rowH - boxes[i].h) / 2 }
      })
      y += rowH + gap
    }
  } else if (mode === 'masonry') {
    // each box goes to the shortest column
    const heights = new Array(cols).fill(0)
    for (const i of order) {
      const c = heights.indexOf(Math.min(...heights))
      out[i] = { x: b.x + c * (maxW + gap) + (maxW - boxes[i].w) / 2, y: b.y + heights[c] }
      heights[c] += boxes[i].h + gap
    }
  } else {
    // around a circle: the straight distance (chord) between neighbours must clear both boxes' diagonals
    const span = order.map((i) => Math.hypot(boxes[i].w, boxes[i].h))
    const chord = 2 * Math.sin(Math.PI / n)
    const r = n === 1 ? 0 : Math.max(...span.map((v, k) => ((v + span[(k + 1) % n]) / 2 + gap) / chord))
    const cx = b.x + b.w / 2
    const cy = b.y + b.h / 2
    order.forEach((i, k) => {
      const a = (k / n) * Math.PI * 2 - Math.PI / 2
      out[i] = { x: cx + r * Math.cos(a) - boxes[i].w / 2, y: cy + r * Math.sin(a) - boxes[i].h / 2 }
    })
  }
  return out
}
