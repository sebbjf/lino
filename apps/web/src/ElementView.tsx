import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ColorFields } from './ColorFields.tsx'
import { LinkCard } from './LinkCard.tsx'
import { drag } from './drag.ts'
import { angleTo, resize } from './geometry.ts'
import { useBoard, type BoardElement } from './store.ts'

const LABELS = { image: 'Image', note: 'Note', color: 'Color', link: 'Link' }

function label(el: BoardElement) {
  if (el.type === 'color') return `Color ${el.hex}`
  if (el.type === 'link') return `Link: ${el.title ?? new URL(el.url).hostname}`
  return LABELS[el.type]
}

type Props = { el: BoardElement; selected: boolean; zoom: number }

export const ElementView = memo(function ElementView({ el, selected, zoom }: Props) {
  const { update, select, remove, duplicate, reorder, checkpoint } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  // a freshly added empty note opens straight into editing
  const [editing, setEditing] = useState(() => selected && el.type === 'note' && !el.text)
  const [pickerOpen, setPickerOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // keep keyboard focus on the selected element (e.g. after duplicate or add)
  useEffect(() => {
    if (selected && !editing && !root.current!.contains(document.activeElement)) root.current!.focus({ preventScroll: true })
  }, [selected, editing])

  const open = () => {
    if (readOnly && el.type !== 'link') return
    if (el.type !== 'link') checkpoint()
    if (el.type === 'note') setEditing(true)
    if (el.type === 'color') setPickerOpen(true)
    if (el.type === 'link') window.open(el.url, '_blank', 'noopener,noreferrer')
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // React bubbles events from portals (the colour popover) through here; ignore those
    // read-only: let the press reach the canvas so it pans
    if (readOnly || e.button !== 0 || !e.currentTarget.contains(e.target as Node)) return
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
    if (e.target !== e.currentTarget || (readOnly && e.key !== 'Enter' && e.key !== 'Escape')) return
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
        if (pickerOpen) {
          setPickerOpen(false)
          break
        }
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
      aria-label={label(el)}
      aria-roledescription="board element"
      className="absolute left-0 top-0 rounded-2xl outline-none"
      style={{
        width: el.w,
        height: el.h,
        transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
        boxShadow: selected ? `0 0 0 ${2 / zoom}px var(--color-primary)` : undefined,
        cursor: readOnly ? undefined : editing ? 'auto' : 'move',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => e.currentTarget.contains(e.target as Node) && open()}
      onKeyDown={onKeyDown}
      onFocus={() => select(el.id)}
    >
      {el.type === 'image' && (
        <img src={el.src} alt="" draggable={false} className="pointer-events-none size-full rounded-2xl object-cover shadow-soft" />
      )}

      {el.type === 'note' && (
        <div className="size-full overflow-hidden rounded-2xl bg-card p-4 text-[15px] leading-relaxed text-card-foreground shadow-soft">
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
            <p className="whitespace-pre-wrap break-words">{el.text || <span className="text-muted-foreground">Empty note</span>}</p>
          )}
        </div>
      )}

      {el.type === 'color' && (
        <div className="relative size-full rounded-2xl shadow-soft" style={{ background: el.hex }}>
          <Popover
            open={pickerOpen && !readOnly}
            onOpenChange={(open) => {
              if (open) checkpoint()
              setPickerOpen(open)
            }}
          >
            <PopoverTrigger
              aria-label={`Edit color ${el.hex}`}
              className="absolute bottom-2 left-2 cursor-pointer rounded-full bg-card/90 px-2 py-0.5 font-mono text-xs text-card-foreground"
              tabIndex={-1}
              onPointerDown={(e) => {
                // keep focus (and keyboard shortcuts) on the element itself; Enter opens the picker for keyboard users
                e.stopPropagation()
                e.preventDefault()
                select(el.id)
                root.current!.focus({ preventScroll: true })
              }}
            >
              {el.hex}
            </PopoverTrigger>
            <PopoverContent side="right" align="start" className="w-60" finalFocus={root}>
              <ColorFields hex={el.hex} onChange={(hex) => update(el.id, { hex })} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {el.type === 'link' && <LinkCard el={el} />}

      {selected && !editing && !readOnly && (
        <>
          <div
            aria-hidden
            className="absolute left-1/2 rounded-full border-ring bg-card"
            style={{ width: handle, height: handle, top: -28 / zoom, marginLeft: -handle / 2, borderWidth: 1.5 / zoom, cursor: 'grab' }}
            onPointerDown={onRotate}
          />
          <div
            aria-hidden
            className="absolute rounded-full border-ring bg-card"
            style={{ width: handle, height: handle, right: -handle / 2, bottom: -handle / 2, borderWidth: 1.5 / zoom, cursor: 'nwse-resize' }}
            onPointerDown={onResize}
          />
        </>
      )}
    </div>
  )
})
