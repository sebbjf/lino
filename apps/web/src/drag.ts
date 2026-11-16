import type { PointerEvent as ReactPointerEvent } from 'react'

/** Fingers on the board right now (Canvas keeps it up to date); two or more is a pinch, never a drag. */
export const touches = new Map<number, { x: number; y: number }>()

/** Tracks a pointer drag from a pointerdown, reporting the screen-space delta until release. */
export function drag(e: ReactPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void, onEnd?: () => void) {
  const sx = e.clientX
  const sy = e.clientY
  const move = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy, ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    onEnd?.()
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
