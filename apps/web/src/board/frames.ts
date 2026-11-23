import { boundsOf, layoutPositions, rotateVec, type Box, type Layout } from './geometry.ts'

// Pure logic for frames and groups; the store and selection commands call these.

/** The elements whose centre lies inside the frame (membership is geometric, nothing is stored). A tilted frame is tested in its own axes. */
export function frameContents<T extends Box & { id: string }>(frame: Box & { id: string }, els: T[]): T[] {
  return els.filter((e) => {
    const p = rotateVec(e.x + e.w / 2 - (frame.x + frame.w / 2), e.y + e.h / 2 - (frame.y + frame.h / 2), -frame.rotation)
    return e.id !== frame.id && Math.abs(p.x) <= frame.w / 2 && Math.abs(p.y) <= frame.h / 2
  })
}

type Movable = Box & { id: string; type: string; locked?: boolean; groupId?: string }

/**
 * What moving `ids` (a drag or a nudge) really moves: unlocked frames carry what lies inside them; a locked element stays,
 * and so does every member of a group that has a locked one, so a group never splits.
 */
export function movingSet<T extends Movable>(ids: string[], els: T[]): T[] {
  const frozen = new Set(els.flatMap((e) => (e.locked && e.groupId ? [e.groupId] : [])))
  const free = (e: T) => !e.locked && !(e.groupId && frozen.has(e.groupId))
  const moved = new Set(els.filter((e) => ids.includes(e.id) && free(e)).map((e) => e.id))
  for (const f of els) if (f.type === 'frame' && moved.has(f.id)) for (const o of frameContents(f, els)) if (free(o)) moved.add(o.id)
  return els.filter((e) => moved.has(e.id))
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
