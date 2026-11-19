import { boundsOf, layoutPositions, type Box, type Layout } from './geometry.ts'

// Pure logic for frames and groups; the store and selection commands call these.

/** The elements whose centre lies inside the frame (membership is geometric, nothing is stored). */
export function frameContents<T extends Box & { id: string }>(frame: Box & { id: string }, els: T[]): T[] {
  return els.filter((e) => {
    const cx = e.x + e.w / 2
    const cy = e.y + e.h / 2
    return e.id !== frame.id && cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + frame.h
  })
}

/** The box of a frame that wraps `boxes` with padding on every side. */
export function frameAround(boxes: Box[], pad = 32) {
  const b = boundsOf(boxes)
  return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }
}

/** `ids` plus every element that shares a group with one of them. */
export function expandGroups(ids: string[], els: { id: string; groupId?: string }[]): string[] {
  const groups = new Set(els.flatMap((e) => (ids.includes(e.id) && e.groupId ? [e.groupId] : [])))
  return els.filter((e) => ids.includes(e.id) || (e.groupId && groups.has(e.groupId))).map((e) => e.id)
}

/** A layout of `boxes` centred in `frame`; the frame grows (never shrinks) when the result does not fit. */
export function layoutInFrame(frame: Box, boxes: Box[], mode: Layout, pad = 24) {
  const placed = layoutPositions(boxes, mode)
  const b = boundsOf(boxes.map((o, i) => ({ ...o, ...placed[i] })))
  const w = Math.max(frame.w, b.w + pad * 2)
  const h = Math.max(frame.h, b.h + pad * 2)
  const dx = frame.x + w / 2 - (b.x + b.w / 2)
  const dy = frame.y + h / 2 - (b.y + b.h / 2)
  return { placed: placed.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })), size: { w, h } }
}
