import { boundsOf, fitView, zoomAt } from './geometry.ts'
import { useBoard } from './store.ts'

// Everything that moves or scales the board's view (pan/zoom), in one place.

/** Top of the screen kept clear when placing the selection: the logo row in App.tsx. */
const TOP_CLEARANCE = 64
/** Wait for a just-opened panel to be laid out (it animates in) before measuring it. */
export const PANEL_LAYOUT_MS = 150

/** Zooms to `z`, keeping the middle of the screen fixed. */
export function zoomTo(z: number) {
  const { view, setView } = useBoard.getState()
  setView(zoomAt(view, innerWidth / 2, innerHeight / 2, z))
}

/** Fits the whole board in view; does nothing on an empty board. */
export function fitAll() {
  const { elements, setView } = useBoard.getState()
  if (elements.length) setView(fitView(elements, innerWidth, innerHeight))
}

/** Pans so the middle of `el` is at the middle of the screen. */
export function centerOn(el: { x: number; y: number; w: number; h: number }) {
  const { view, setView } = useBoard.getState()
  setView({ ...view, x: innerWidth / 2 - (el.x + el.w / 2) * view.zoom, y: innerHeight / 2 - (el.y + el.h / 2) * view.zoom })
}

/** Tabbing to an element off screen moves the view to it; the canvas never scrolls by itself. */
export function panIntoView(el: { x: number; y: number; w: number; h: number }) {
  const { view } = useBoard.getState()
  const left = view.x + el.x * view.zoom
  const top = view.y + el.y * view.zoom
  const inside = left >= 0 && top >= 0 && left + el.w * view.zoom <= innerWidth && top + el.h * view.zoom <= innerHeight
  if (!inside) centerOn(el)
}

/** Moves the view to `to` with an ease-out instead of a jump. Any other change to the view (a pan, a zoom) cancels it. */
export function glideTo(to: { x: number; y: number }, ms = 320) {
  const { view: from, setView } = useBoard.getState()
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView({ ...from, ...to })
  const t0 = performance.now()
  let last = from
  const frame = (now: number) => {
    if (useBoard.getState().view !== last) return // the user moved the view meanwhile
    const t = Math.min(1, (now - t0) / ms)
    const e = 1 - (1 - t) ** 3
    last = { ...from, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
    setView(last)
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** If the open style panel covers the selection, glides the view so the selection sits in the largest free area beside it. */
export function revealSelection() {
  const panel = document.querySelector<HTMLElement>('[data-panel=style]')
  const { selectedIds, elements, view } = useBoard.getState()
  const sel = elements.filter((e) => selectedIds.includes(e.id))
  if (!panel || !sel.length) return
  const P = panel.getBoundingClientRect()
  const b = boundsOf(sel)
  const S = { x: b.x * view.zoom + view.x, y: b.y * view.zoom + view.y, w: b.w * view.zoom, h: b.h * view.zoom }
  const m = 16
  if (S.x + S.w < P.left - m || S.x > P.right + m || S.y + S.h < P.top - m || S.y > P.bottom + m) return
  // free areas: above the panel and either side of it
  const top = TOP_CLEARANCE
  const areas = [
    { x: 0, y: top, w: innerWidth, h: P.top - top - m },
    { x: 0, y: top, w: P.left - m, h: innerHeight - top },
    { x: P.right + m, y: top, w: innerWidth - P.right - m, h: innerHeight - top },
  ].filter((a) => a.w > 0 && a.h > 0)
  const best = areas.sort((a, c) => c.w * c.h - a.w * a.h)[0]
  if (!best) return
  glideTo({ x: view.x + best.x + best.w / 2 - (S.x + S.w / 2), y: view.y + best.y + best.h / 2 - (S.y + S.h / 2) })
}
