import { useEffect, useRef, type DragEvent, type PointerEvent } from 'react'
import { drag } from './drag.ts'
import { ElementView } from './ElementView.tsx'
import { zoomAt } from './geometry.ts'
import { addImages } from './image.ts'
import { addLink, asUrl } from './link.ts'
import { useBoard } from './store.ts'

export function Canvas() {
  const elements = useBoard((s) => s.elements)
  const selectedId = useBoard((s) => s.selectedId)
  const view = useBoard((s) => s.view)
  const readOnly = useBoard((s) => s.readOnly)
  const guides = useBoard((s) => s.guides)
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
    const { select, setView } = useBoard.getState()
    select(null)
    ;(document.activeElement as HTMLElement | null)?.blur()
    const v = view
    drag(e, (dx, dy) => setView({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    if (useBoard.getState().readOnly) return
    const at = { x: (e.clientX - view.x) / view.zoom, y: (e.clientY - view.y) / view.zoom }
    const files = [...e.dataTransfer.files]
    const url = asUrl(e.dataTransfer.getData('text/uri-list').split('\n')[0].trim())
    if (files.length) addImages(files, at)
    else if (url) addLink(url, at)
  }

  const grid = 24 * view.zoom

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Board"
      aria-describedby="board-help"
      className="fixed inset-0 cursor-grab touch-none select-none overflow-hidden active:cursor-grabbing"
      style={{
        backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)',
        backgroundSize: `${grid}px ${grid}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={onPointerDown}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <p id="board-help" className="sr-only">
        {readOnly
          ? 'Tab through the elements. Enter opens a link.'
          : 'Tab through the elements. Arrows move the selected one, Alt+arrows resize it, R rotates it, Enter edits it, Delete removes it.'}
      </p>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        {elements.map((el) => (
          <ElementView key={el.id} el={el} selected={el.id === selectedId} zoom={view.zoom} />
        ))}
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
