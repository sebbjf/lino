import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { drag } from './drag.ts'
import { ElementView } from './ElementView.tsx'
import { boundsOf, zoomAt } from './geometry.ts'
import { importBoardFile, isBoardFile } from './boardFile.ts'
import { addImages } from './image.ts'
import { addLink, asUrl } from './link.ts'
import { useBoard } from './store.ts'
import { textOn } from './style.ts'

export function Canvas() {
  const elements = useBoard((s) => s.elements)
  const selectedIds = useBoard((s) => s.selectedIds)
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const view = useBoard((s) => s.view)
  const readOnly = useBoard((s) => s.readOnly)
  const guides = useBoard((s) => s.guides)
  const board = useBoard((s) => s.board)
  const ref = useRef<HTMLDivElement>(null)

  // wheel pans, Ctrl/Cmd + wheel (and trackpad pinch) zooms; needs a non-passive listener
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { view: v, setView } = useBoard.getState()
      if (e.ctrlKey || e.metaKey) {
        const delta = Math.max(-50, Math.min(50, e.deltaY))
        setView(zoomAt(v, e.clientX, e.clientY, v.zoom * Math.exp(-delta * 0.01)))
      } else {
        setView({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY })
      }
    }
    const node = ref.current!
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }, [])

  const onPointerDown = (e: PointerEvent) => {
    if ((e.button !== 0 && e.button !== 1) || !e.currentTarget.contains(e.target as Node)) return
    const { select, selectMany, setView } = useBoard.getState()
    ;(document.activeElement as HTMLElement | null)?.blur()
    const v = view
    // Shift+drag draws a selection box, adding what it touches to the selection; a plain drag pans
    if (e.shiftKey && e.button === 0 && !readOnly) {
      const base = useBoard.getState().selectedIds
      const sx = (e.clientX - v.x) / v.zoom
      const sy = (e.clientY - v.y) / v.zoom
      drag(
        e,
        (dx, dy) => {
          const r = { x: Math.min(sx, sx + dx / v.zoom), y: Math.min(sy, sy + dy / v.zoom), w: Math.abs(dx / v.zoom), h: Math.abs(dy / v.zoom) }
          setMarquee(r)
          const hits = useBoard
            .getState()
            .elements.filter((el) => {
              const b = boundsOf([el])
              return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y
            })
            .map((el) => el.id)
          selectMany([...new Set([...base, ...hits])])
        },
        () => setMarquee(null),
      )
      return
    }
    select(null)
    // incremental, from the live view, so a pinch in the middle of a pan doesn't make the view jump back
    let last = [0, 0]
    drag(e, (dx, dy) => {
      if (touches.current.size < 2) {
        const cur = useBoard.getState().view
        setView({ ...cur, x: cur.x + dx - last[0], y: cur.y + dy - last[1] })
      }
      last = [dx, dy]
    })
  }

  // touch: two fingers pinch-zoom around their midpoint and pan with it
  const touches = useRef(new Map<number, { x: number; y: number }>())
  const onTouchDownCapture = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size > 1) e.stopPropagation() // the second finger never drags an element
  }
  useEffect(() => {
    const node = ref.current!
    const pts = touches.current
    const move = (e: globalThis.PointerEvent) => {
      const p = pts.get(e.pointerId)
      if (!p) return
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const before = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
        const [c, d] = [...pts.values()]
        const after = { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2, d: Math.hypot(c.x - d.x, c.y - d.y) }
        const { view: v, setView } = useBoard.getState()
        const z = zoomAt(v, before.x, before.y, v.zoom * (before.d ? after.d / before.d : 1))
        setView({ ...z, x: z.x + after.x - before.x, y: z.y + after.y - before.y })
      } else pts.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    const up = (e: globalThis.PointerEvent) => pts.delete(e.pointerId)
    node.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      node.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [])

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    if (useBoard.getState().readOnly) return
    const at = { x: (e.clientX - view.x) / view.zoom, y: (e.clientY - view.y) / view.zoom }
    const files = [...e.dataTransfer.files]
    const board = files.find(isBoardFile)
    if (board) return void importBoardFile(board)
    const url = asUrl(e.dataTransfer.getData('text/uri-list').split('\n')[0].trim())
    if (files.length) addImages(files, at)
    else if (url) addLink(url, at)
  }

  const grid = 24 * view.zoom
  // on a custom background the dots/lines follow its contrast color, faintly
  const ink = board.bg ? `color-mix(in srgb, ${textOn(board.bg) ?? '#000'} 18%, transparent)` : 'var(--color-dot)'
  const pattern = board.pattern ?? 'dots'
  const backgroundImage = {
    dots: `radial-gradient(${ink} 1px, transparent 1px)`,
    grid: `linear-gradient(${ink} 1px, transparent 1px), linear-gradient(90deg, ${ink} 1px, transparent 1px)`,
    plain: 'none',
  }[pattern]

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Board"
      aria-describedby="board-help"
      className="fixed inset-0 cursor-(--cursor-arrow) touch-none select-none overflow-hidden active:cursor-(--cursor-move)"
      style={{
        backgroundColor: board.bg,
        backgroundImage,
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDownCapture={onTouchDownCapture}
      onPointerDown={onPointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p id="board-help" className="sr-only">
        {readOnly
          ? 'Tab through the elements. Enter opens a link.'
          : 'Tab through the elements. Shift+click or Shift+drag selects several, Ctrl+A selects all. Arrows move the selection, Alt+arrows resize it, R rotates it, Enter edits it, Delete removes it.'}
      </p>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {elements.map((el) => (
          <ElementView key={el.id} el={el} selected={selected.has(el.id)} solo={selected.size === 1 && selected.has(el.id)} zoom={view.zoom} />
        ))}
        {marquee && (
          <div
            aria-hidden
            className="pointer-events-none absolute rounded-sm border border-guide bg-guide/10"
            style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, borderWidth: 1 / view.zoom }}
          />
        )}
        {guides.map((g, i) => (
          <div
            key={i}
            aria-hidden
            className="pointer-events-none absolute bg-guide"
            style={
              g.axis === 'x'
                ? { left: g.pos, top: g.from, width: 1 / view.zoom, height: g.to - g.from }
                : { left: g.from, top: g.pos, width: g.to - g.from, height: 1 / view.zoom }
            }
          />
        ))}
      </div>
    </div>
  )
}
