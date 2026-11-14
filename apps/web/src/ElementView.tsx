import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { drag } from './drag.ts'
import { angleTo, resize } from './geometry.ts'
import { useBoard, type BoardElement } from './store.ts'

const LABELS = { image: 'Image', note: 'Note', color: 'Color' }

type Props = { el: BoardElement; selected: boolean; zoom: number }

export const ElementView = memo(function ElementView({ el, selected, zoom }: Props) {
  const { update, select, remove, duplicate, reorder, checkpoint } = useBoard.getState()
  // a freshly added empty note opens straight into editing
  const [editing, setEditing] = useState(() => selected && el.type === 'note' && !el.text)
  const colorInput = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)

  // keep keyboard focus on the selected element (e.g. after duplicate or add)
  useEffect(() => {
    if (selected && !editing && !root.current!.contains(document.activeElement)) root.current!.focus({ preventScroll: true })
  }, [selected, editing])

  const open = () => {
    checkpoint()
    if (el.type === 'note') setEditing(true)
    if (el.type === 'color') colorInput.current?.showPicker()
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.stopPropagation()
    select(el.id)
    if (editing) return
    e.currentTarget.focus()
    const { x, y } = el
    checkpoint()
    drag(e, (dx, dy) => update(el.id, { x: x + dx / zoom, y: y + dy / zoom }))
  }

  const onResize = (e: PointerEvent) => {
    e.stopPropagation()
    const box = { ...el }
    checkpoint()
    // images keep their aspect ratio; Shift toggles it
    drag(e, (dx, dy, ev) => update(el.id, resize(box, dx / zoom, dy / zoom, (el.type === 'image') !== ev.shiftKey)))
  }

  const onRotate = (e: PointerEvent) => {
    e.stopPropagation()
    const box = { ...el }
    const v = useBoard.getState().view
    checkpoint()
    drag(e, (_dx, _dy, ev) =>
      update(el.id, { rotation: angleTo(box, (ev.clientX - v.x) / v.zoom, (ev.clientY - v.y) / v.zoom, ev.shiftKey) }),
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return
    const mod = e.metaKey || e.ctrlKey
    const step = e.shiftKey ? 10 : 1
    if (e.key.startsWith('Arrow')) checkpoint()
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        remove(el.id)
        break
      case 'ArrowLeft':
        update(el.id, { x: el.x - step })
        break
      case 'ArrowRight':
        update(el.id, { x: el.x + step })
        break
      case 'ArrowUp':
        update(el.id, { y: el.y - step })
        break
      case 'ArrowDown':
        update(el.id, { y: el.y + step })
        break
      case ']':
        reorder(el.id, mod ? 'front' : 'forward')
        break
      case '[':
        reorder(el.id, mod ? 'back' : 'backward')
        break
      case 'Enter':
        open()
        break
      case 'Escape':
        select(null)
        e.currentTarget.blur()
        break
      case 'd':
        if (!mod) return
        duplicate(el.id)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const handle = 12 / zoom

  return (
    <div
      ref={root}
      role="group"
      tabIndex={0}
      aria-label={el.type === 'color' ? `Color ${el.hex}` : LABELS[el.type]}
      aria-roledescription="board element"
      className="absolute left-0 top-0 rounded-2xl outline-none"
      style={{
        width: el.w,
        height: el.h,
        transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
        boxShadow: selected ? `0 0 0 ${2 / zoom}px var(--color-focus)` : undefined,
        cursor: editing ? 'auto' : 'move',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={open}
      onKeyDown={onKeyDown}
      onFocus={() => select(el.id)}
    >
      {el.type === 'image' && (
        <img src={el.src} alt="" draggable={false} className="pointer-events-none size-full rounded-2xl object-cover shadow-sm" />
      )}

      {el.type === 'note' && (
        <div className="size-full overflow-hidden rounded-2xl bg-white p-4 text-[15px] leading-relaxed text-stone-800 shadow-sm">
          {editing ? (
            <textarea
              autoFocus
              aria-label="Note text"
              className="size-full resize-none select-text bg-transparent outline-none"
              value={el.text}
              placeholder="Write something…"
              onChange={(e) => update(el.id, { text: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words">{el.text || <span className="text-stone-500">Empty note</span>}</p>
          )}
        </div>
      )}

      {el.type === 'color' && (
        <div className="relative size-full rounded-2xl shadow-sm" style={{ background: el.hex }}>
          <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 font-mono text-xs text-stone-700">
            {el.hex}
          </span>
          <input
            ref={colorInput}
            type="color"
            tabIndex={-1}
            aria-label="Pick color"
            className="pointer-events-none absolute inset-0 size-full opacity-0"
            value={el.hex}
            onChange={(e) => update(el.id, { hex: e.target.value })}
          />
        </div>
      )}

      {selected && !editing && (
        <>
          <div
            aria-hidden
            className="absolute left-1/2 rounded-full border-stone-400 bg-white"
            style={{ width: handle, height: handle, top: -28 / zoom, marginLeft: -handle / 2, borderWidth: 1.5 / zoom, cursor: 'grab' }}
            onPointerDown={onRotate}
          />
          <div
            aria-hidden
            className="absolute rounded-full border-stone-400 bg-white"
            style={{ width: handle, height: handle, right: -handle / 2, bottom: -handle / 2, borderWidth: 1.5 / zoom, cursor: 'nwse-resize' }}
            onPointerDown={onResize}
          />
        </>
      )}
    </div>
  )
})
