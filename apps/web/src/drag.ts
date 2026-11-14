import type { PointerEvent as ReactPointerEvent } from 'react'

/** Tracks a pointer drag from a pointerdown, reporting the screen-space delta until release. */
export function drag(e: ReactPointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void) {
  const sx = e.clientX
  const sy = e.clientY
  const move = (ev: PointerEvent) => onMove(ev.clientX - sx, ev.clientY - sy, ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}
