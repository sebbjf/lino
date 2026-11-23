import { layoutInFrame } from './frames.ts'
import { layoutPositions, type Layout } from './geometry.ts'
import type { BoardElement } from './store.ts'

// Pure placement rules for new and rearranged elements. Which elements may be touched is decided before, in selection.ts.

/** Space between swatches, and between a swatch row and the element above it. */
export const SWATCH_GAP = 8
/** Where a copy lands relative to its source; also how far a repeated toolbar add steps aside. */
export const STEP_OFFSET = 24

/** A row of colour swatches under `el`, as wide as it is. */
export function swatchRowUnder(el: BoardElement, hexes: string[]): BoardElement[] {
  const side = (el.w - SWATCH_GAP * (hexes.length - 1)) / hexes.length
  return hexes.map((hex, i): BoardElement => ({ id: crypto.randomUUID(), type: 'color', hex, x: el.x + i * (side + SWATCH_GAP), y: el.y + el.h + SWATCH_GAP, w: side, h: side, rotation: 0 }))
}

/** Offset copies of `sources`; a copied group becomes a group of its own, not new members of the original. */
export function copiesOf(sources: BoardElement[]): BoardElement[] {
  const groups = new Map<string, string>()
  return sources.map((src) => {
    const copy = { ...src, id: crypto.randomUUID(), x: src.x + STEP_OFFSET, y: src.y + STEP_OFFSET }
    if (src.groupId) copy.groupId = groups.get(src.groupId) ?? groups.set(src.groupId, crypto.randomUUID()).get(src.groupId)
    return copy
  })
}

/** `all` with `els` placed by the layout `mode`. With a `frame`, they are placed within it and it grows if they need room. */
export function arranged(all: BoardElement[], els: BoardElement[], mode: Layout, frame?: BoardElement): BoardElement[] {
  let placed = layoutPositions(els, mode)
  let size: { w: number; h: number } | undefined
  if (frame) ({ placed, size } = layoutInFrame(frame, els, mode))
  const pos = new Map(placed.map((p, i) => [els[i].id, p]))
  let elements = all.map((e) => (pos.has(e.id) ? { ...e, ...pos.get(e.id)! } : e.id === frame?.id ? { ...e, ...size } : e))
  if (mode === 'fan') {
    // stack the hand left to right, each card over the previous one, in the layers these elements already had
    const hand = elements.filter((e) => pos.has(e.id)).sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2))
    let k = 0
    elements = elements.map((e) => (pos.has(e.id) ? hand[k++] : e))
  }
  return elements
}
