import { boundsOf, layoutPositions, type Layout } from '../board/geometry.ts'

// The hero board's pure parts: where the photos start, how a layout is placed, and how big the stage is.

/** Design width of the full-screen stage, and of the narrow stages on tablets and phones. */
const FULL_W = 1440
const TABLET_W = 900
const PHONE_W = 440
/** Below this window width the narrow stage uses the phone design. */
const PHONE_BELOW = 700
const TABLET_H = 560
const PHONE_H = 480
/** Height kept free at the bottom of the full-screen stage for the layout toolbar. */
const TOOLBAR_ROOM = 110

/**
 * The stage in design units (`W` x `H`, `Hu` usable above the toolbar) and the scale `k` that fits it to the
 * element's measured `width`. Full screen keeps the window's shape; before it is measured it assumes 1440x900.
 */
export function stageSize(fill: boolean, width: number, height: number) {
  const W = fill ? FULL_W : width < PHONE_BELOW ? PHONE_W : TABLET_W
  const H = fill ? Math.round((W * (height || 900)) / (width || FULL_W)) : width < PHONE_BELOW ? PHONE_H : TABLET_H
  return { W, H, Hu: fill ? H - TOOLBAR_ROOM : H, k: width ? width / W : 1 }
}

export type Item = { id: number; src: string; x: number; y: number; w: number; h: number; rotation: number; z: number }

// Full screen: four photos on each side of the headline, in two staggered columns mirrored left/right.
// x is the distance from that side's edge and y is laid out for a 640-unit block centered in the stage (both in design units);
// the narrow stage starts as a collage. Sizes keep each photo's own aspect ratio.
export const START = [
  { id: 1, src: 'yellow', side: 'l', x: 24, y: 40, w: 160, h: 240, rotation: -2 },
  { id: 2, src: 'fabric', side: 'l', x: 24, y: 310, w: 188, h: 125, rotation: 2 },
  { id: 3, src: 'sun', side: 'l', x: 206, y: 130, w: 140, h: 224, rotation: 2 },
  { id: 4, src: 'lantern', side: 'l', x: 206, y: 385, w: 150, h: 225, rotation: -2 },
  { id: 5, src: 'bust', side: 'r', x: 24, y: 30, w: 150, h: 225, rotation: 2 },
  { id: 6, src: 'amber', side: 'r', x: 24, y: 285, w: 170, h: 113, rotation: -2 },
  { id: 7, src: 'sleeves', side: 'r', x: 206, y: 130, w: 160, h: 120, rotation: -2 },
  { id: 8, src: 'vases', side: 'r', x: 206, y: 280, w: 135, h: 240, rotation: 2 },
].map(({ side, ...it }, i) => ({ ...it, right: side === 'r', z: i + 1 }))
export const startAt = (W: number, Hu: number): Item[] =>
  START.map(({ right, ...it }) => ({ ...it, x: right ? W - it.x - it.w : it.x, y: it.y + (Hu - 640) / 2 }))

/** 'original' is the hand-placed start (a collage on narrow screens), same as on page load. */
export type Mode = Layout | 'scatter' | 'original'
export const ARRANGE: { mode: Mode; label: string }[] = [
  { mode: 'original', label: 'Original' },
  { mode: 'scatter', label: 'Scatter' },
  { mode: 'fan', label: 'Fan' },
  { mode: 'sunflower', label: 'Sunflower' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'collage', label: 'Collage' },
]
const rand = (a: number) => (Math.random() * 2 - 1) * a

/** Places items in a template (or scatters them) and returns the zoom that fits them in the stage. */
export function arrange(items: Item[], mode: Layout | 'scatter', W: number, Hu: number) {
  if (mode === 'scatter')
    return {
      items: items.map((it) => ({ ...it, x: 20 + Math.random() * (W - it.w - 40), y: 20 + Math.random() * (Hu - it.h - 40), rotation: rand(9) })),
      z: 1,
    }
  const pos = layoutPositions(items, mode, 18)
  const moved = items.map((it, i) => ({ ...it, ...pos[i] }))
  const b = boundsOf(moved)
  const dx = W / 2 - (b.x + b.w / 2)
  const dy = Hu / 2 - (b.y + b.h / 2)
  return { items: moved.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })), z: Math.min(1, (W - 48) / b.w, (Hu - 48) / b.h) }
}
