import { movingSet } from './frames.ts'
import { boundsOf, snapMove, type Guide } from './geometry.ts'
import type { BoardElement } from './store.ts'

/** A move gesture as planned at pointer-down: what moves, its visible (rotated) outline, and the outlines it can snap to. */
export type MovePlan = { moving: BoardElement[]; own: ReturnType<typeof boundsOf>; others: ReturnType<typeof boundsOf>[] }

/** Plans moving `ids`: a frame takes what lies inside it along; locked elements, and groups holding one, stay. */
export function planMove(ids: string[], els: BoardElement[]): MovePlan {
  const moving = movingSet(ids, els)
  const carried = new Set([...ids, ...moving.map((o) => o.id)])
  return { moving, own: boundsOf(moving), others: els.flatMap((o) => (carried.has(o.id) ? [] : [boundsOf([o])])) }
}

/**
 * New positions for a world-space delta from the start, and the guides to show. `snap` is the snap distance
 * in world px: the outline snaps to the others' edges and centers within it; 0 moves freely.
 */
export function moveTo({ moving, own, others }: MovePlan, dx: number, dy: number, snap: number) {
  let guides: Guide[] = []
  if (snap) {
    const s = snapMove({ ...own, x: own.x + dx, y: own.y + dy }, others, snap)
    dx += s.dx
    dy += s.dy
    guides = s.guides
  }
  return { pos: Object.fromEntries(moving.map((o) => [o.id, { x: o.x + dx, y: o.y + dy }])), guides }
}
