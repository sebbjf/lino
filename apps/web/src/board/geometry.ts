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

export type Layout = 'grid' | 'masonry' | 'row' | 'column' | 'circle' | 'sunflower' | 'fan' | 'collage' | 'mosaic'
export const LAYOUTS: Layout[] = ['grid', 'masonry', 'row', 'column', 'circle', 'sunflower', 'fan', 'collage', 'mosaic']
type Placed = { x: number; y: number; rotation: number }

/** Small deterministic noise in [-1, 1] so a layout looks hand-made but is the same every time. */
const noise = (k: number) => {
  const v = Math.sin(k * 12.9898 + 78.233) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}

/** What every layout needs: the boxes, their reading order, the gap, and the shared measures of the set. */
type Frame = { boxes: Box[]; order: number[]; gap: number; b: Rect; cx: number; cy: number; maxW: number; cols: number }

/** Row height used to read boxes left to right even when their tops are slightly uneven. */
const READING_BAND = 40

function readingOrder(boxes: Box[]) {
  const band = (i: number) => Math.round(boxes[i].y / READING_BAND)
  return boxes.map((_, i) => i).sort((i, j) => band(i) - band(j) || boxes[i].x - boxes[j].x)
}

/** Boxes side by side along one line, each centered on it. */
function line(f: Frame, mode: 'row' | 'column'): Placed[] {
  const { boxes, order, gap, b } = f
  const along = mode === 'row' ? 'w' : 'h'
  const cross = mode === 'row' ? 'h' : 'w'
  const size = Math.max(...boxes.map((o) => o[cross]))
  const out: Placed[] = []
  let at = 0
  for (const i of order) {
    const off = (size - boxes[i][cross]) / 2
    out[i] = mode === 'row' ? { x: b.x + at, y: b.y + off, rotation: 0 } : { x: b.x + off, y: b.y + at, rotation: 0 }
    at += boxes[i][along] + gap
  }
  return out
}

/** Cells as wide as the widest box; each row as tall as its tallest box. */
function grid({ boxes, order, gap, b, maxW, cols }: Frame): Placed[] {
  const out: Placed[] = []
  let y = b.y
  for (let r = 0; r * cols < order.length; r++) {
    const row = order.slice(r * cols, (r + 1) * cols)
    const rowH = Math.max(...row.map((i) => boxes[i].h))
    row.forEach((i, c) => {
      out[i] = { x: b.x + c * (maxW + gap) + (maxW - boxes[i].w) / 2, y: y + (rowH - boxes[i].h) / 2, rotation: 0 }
    })
    y += rowH + gap
  }
  return out
}

/** Each box goes to the shortest column. */
function masonry({ boxes, order, gap, b, maxW, cols }: Frame): Placed[] {
  const out: Placed[] = []
  const heights: number[] = new Array(cols).fill(0)
  for (const i of order) {
    const c = heights.indexOf(Math.min(...heights))
    out[i] = { x: b.x + c * (maxW + gap) + (maxW - boxes[i].w) / 2, y: b.y + heights[c], rotation: 0 }
    heights[c] += boxes[i].h + gap
  }
  return out
}

/** Around a circle: the straight distance (chord) between neighbours must clear both boxes' diagonals. */
function circle({ boxes, order, gap, cx, cy }: Frame): Placed[] {
  const n = order.length
  const span = order.map((i) => Math.hypot(boxes[i].w, boxes[i].h))
  const chord = 2 * Math.sin(Math.PI / n)
  const r = n === 1 ? 0 : Math.max(...span.map((v, k) => ((v + span[(k + 1) % n]) / 2 + gap) / chord))
  const out: Placed[] = []
  order.forEach((i, k) => {
    const a = (k / n) * Math.PI * 2 - Math.PI / 2
    out[i] = { x: cx + r * Math.cos(a) - boxes[i].w / 2, y: cy + r * Math.sin(a) - boxes[i].h / 2, rotation: 0 }
  })
  return out
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const SPIRAL_STEP = 0.2

/**
 * Phyllotaxis: seeds along a golden-angle spiral, the biggest in the middle. Each box walks out
 * along the spiral from where the last one stopped until it touches nothing, so it packs tight.
 */
function sunflower({ boxes, order, gap, cx, cy }: Frame): Placed[] {
  const bySize = [...order].sort((i, j) => boxes[j].w * boxes[j].h - boxes[i].w * boxes[i].h)
  const unit = Math.min(...boxes.map((o) => Math.min(o.w, o.h))) / 2
  const placed: Rect[] = []
  const free = (r: Rect) =>
    placed.every((q) => r.x >= q.x + q.w + gap || q.x >= r.x + r.w + gap || r.y >= q.y + q.h + gap || q.y >= r.y + r.h + gap)
  // ponytail: O(n²) checks per step, fine for a board of a few hundred elements
  const out: Placed[] = []
  let t = 0
  for (const i of bySize) {
    const { w, h } = boxes[i]
    let r = { x: cx - w / 2, y: cy - h / 2, w, h }
    while (!free(r)) {
      t += SPIRAL_STEP
      const d = unit * Math.sqrt(t)
      r = { x: cx + d * Math.cos(t * GOLDEN_ANGLE) - w / 2, y: cy + d * Math.sin(t * GOLDEN_ANGLE) - h / 2, w, h }
    }
    placed.push(r)
    out[i] = { x: r.x, y: r.y, rotation: 0 }
  }
  return out
}

const FAN_MAX_OPEN = (110 * Math.PI) / 180

/**
 * A hand of cards turned around a pivot below the middle. Each card covers the previous one but
 * leaves 60% of its width showing (visible = d - w_k/2 + w_{k-1}/2, so d = w_k/2 + 0.1 w_{k-1});
 * the radius grows if the hand would open past ~110°.
 */
function fan({ boxes, order, cx, cy, maxW }: Frame): Placed[] {
  const n = order.length
  const w = order.map((i) => boxes[i].w)
  const angles = (radius: number) => {
    const a = [0]
    for (let k = 1; k < n; k++) a.push(a[k - 1] + 2 * Math.asin(Math.min(1, (w[k] / 2 + 0.1 * w[k - 1]) / (2 * radius))))
    return a
  }
  let radius = Math.max(Math.max(...boxes.map((o) => o.h)) * 1.6, maxW)
  let a = angles(radius)
  while (a[n - 1] > FAN_MAX_OPEN) a = angles((radius *= 1.15))
  const pivotY = cy + radius
  const out: Placed[] = []
  order.forEach((i, k) => {
    const t = a[k] - a[n - 1] / 2
    out[i] = { x: cx + radius * Math.sin(t) - boxes[i].w / 2, y: pivotY - radius * Math.cos(t) - boxes[i].h / 2, rotation: Math.round((t * 1800) / Math.PI) / 10 }
  })
  return out
}

/** Share of a piece's width after which the next piece in a mosaic row starts. */
const MOSAIC_STEP = 0.8

/** A few wide rows of about the same length, so the last one is not left short. */
function mosaicRows(boxes: Box[], order: number[]) {
  const target = boxes.reduce((s, o) => s + o.w * MOSAIC_STEP, 0) / Math.max(1, Math.round(Math.sqrt(order.length / 2)))
  const rows: number[][] = [[]]
  let used = 0
  for (const i of order) {
    if (rows.at(-1)!.length && used + boxes[i].w * 0.4 > target) {
      rows.push([])
      used = 0
    }
    rows.at(-1)!.push(i)
    used += boxes[i].w * MOSAIC_STEP
  }
  return rows
}

/** Staggered rows of flat pieces, each overlapping its neighbours and the row above, like prints pinned to a wall. */
function mosaic({ boxes, order, b }: Frame): Placed[] {
  const avgW = boxes.reduce((s, o) => s + o.w, 0) / boxes.length
  const out: Placed[] = []
  let top = 0
  let k = 0
  mosaicRows(boxes, order).forEach((row, r) => {
    const rowH = Math.max(...row.map((i) => boxes[i].h))
    let x = b.x + (r % 2 ? avgW * 0.3 : 0)
    for (const i of row) {
      const o = boxes[i]
      out[i] = { x, y: b.y + top + (rowH - o.h) / 2 + noise(k++) * o.h * 0.12, rotation: 0 }
      x += o.w * MOSAIC_STEP
    }
    top += rowH * 0.75
  })
  return out
}

/** A masonry that overlaps a little, each piece nudged and tilted like photos on a table. */
function collage(f: Frame): Placed[] {
  const { boxes, order } = f
  const tight = masonry({ ...f, gap: -Math.min(...boxes.map((o) => Math.min(o.w, o.h))) * 0.12 })
  const out: Placed[] = []
  order.forEach((i, k) => {
    const t = tight[i]
    out[i] = { x: t.x + noise(k) * 14, y: t.y + noise(k + 100) * 14, rotation: Math.round(noise(k + 200) * 60) / 10 }
  })
  return out
}

const ARRANGE: Record<Layout, (f: Frame) => Placed[]> = {
  row: (f) => line(f, 'row'),
  column: (f) => line(f, 'column'),
  grid,
  masonry,
  circle,
  sunflower,
  fan,
  mosaic,
  collage,
}

/**
 * New top-left positions (and rotation) that arrange boxes into a template, keeping their sizes.
 * Boxes are taken in reading order (top to bottom, then left to right) and the layout starts at
 * their current bounds' top-left (circle, sunflower and fan keep their center). Returned in input order.
 * Only fan and collage tilt things; the rest set rotation to 0.
 */
export function layoutPositions(boxes: Box[], mode: Layout, gap = 24): Placed[] {
  if (!boxes.length) return []
  const b = boundsOf(boxes)
  return ARRANGE[mode]({
    boxes,
    order: readingOrder(boxes),
    gap,
    b,
    cx: b.x + b.w / 2,
    cy: b.y + b.h / 2,
    maxW: Math.max(...boxes.map((o) => o.w)),
    cols: Math.ceil(Math.sqrt(boxes.length)),
  })
}
