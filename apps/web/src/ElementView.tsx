import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ColorFields } from './ColorFields.tsx'
import { LinkCard } from './LinkCard.tsx'
import { drag } from './drag.ts'
import { harmonies } from './colors.ts'
import { angleTo, boundsOf, resize, rotateVec, snapMove } from './geometry.ts'
import type { Guide } from './geometry.ts'
import { justDropped, useBoard, type BoardElement } from './store.ts'
import { DEFAULT_DUO, FAMILY, NOTE_TEXT, loadFamily, rgb, surface, textOn } from './style.ts'

/** Snap distance in screen pixels. */
const SNAP_PX = 6

const LABELS = { image: 'Image', note: 'Note', color: 'Color', link: 'Link' }

function label(el: BoardElement) {
  if (el.type === 'color') return `Color ${el.hex}`
  if (el.type === 'link') return `Link: ${el.title ?? new URL(el.url).hostname}`
  return LABELS[el.type]
}

/** Hue-rotated companions of a swatch; clicking one adds it as a new swatch beside this one. */
function Harmonies({ el }: { el: Extract<BoardElement, { type: 'color' }> }) {
  const add = (hex: string, i: number) =>
    useBoard.getState().add({ type: 'color', hex, w: el.w, h: el.h }, { x: el.x + el.w * 1.5 + 16 + i * (el.w + 16), y: el.y + el.h / 2 })
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Harmonies: click to add</p>
      {harmonies(el.hex).map((g) => (
        <div key={g.name} className="flex items-center justify-between gap-2">
          <span className="text-xs">{g.name}</span>
          <span className="flex gap-1">
            {g.colors.map((hex, i) => (
              <button
                key={hex + i}
                type="button"
                aria-label={`Add ${g.name.toLowerCase()} color ${hex}`}
                title={hex}
                className="size-6 rounded-full border"
                style={{ background: hex }}
                onClick={() => add(hex, i)}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

/** SVG duotone: grey by luma, then map black to shadows and white to highlights (same math as filterPixels). */
function DuotoneFilter({ id, duo }: { id: string; duo: [string, string] }) {
  const [a, b] = duo.map((h) => rgb(h) ?? [0, 0, 0])
  const table = (c: number) => `${a[c] / 255} ${b[c] / 255}`
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={`duo-${id}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

/** `solo`: the only selected element, which gets handles and keyboard focus. */
type Props = { el: BoardElement; selected: boolean; solo: boolean; zoom: number }

/** Tabbing to an element off screen moves the view to it; the canvas never scrolls by itself. */
function panIntoView(el: BoardElement) {
  const { view, setView } = useBoard.getState()
  const left = view.x + el.x * view.zoom
  const top = view.y + el.y * view.zoom
  const inside = left >= 0 && top >= 0 && left + el.w * view.zoom <= innerWidth && top + el.h * view.zoom <= innerHeight
  if (inside) return
  setView({ ...view, x: innerWidth / 2 - (el.x + el.w / 2) * view.zoom, y: innerHeight / 2 - (el.y + el.h / 2) * view.zoom })
}

export const ElementView = memo(function ElementView({ el, selected, solo, zoom }: Props) {
  const { update, moveMany, select, remove, duplicate, reorder, checkpoint } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  // a freshly added empty note opens straight into editing
  const [editing, setEditing] = useState(() => selected && el.type === 'note' && !el.text)
  const [pickerOpen, setPickerOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // keep keyboard focus on the selected element (e.g. after duplicate or add)
  // plays once, for an element just added in messy mode
  const [drop] = useState(() => justDropped.delete(el.id))
  const family = el.type === 'note' ? el.family : undefined
  useEffect(() => {
    if (family) loadFamily(family)
  }, [family])

  useEffect(() => {
    if (solo && !editing && !root.current!.contains(document.activeElement)) root.current!.focus({ preventScroll: true })
  }, [solo, editing])

  /** The elements an action on this one applies to: the whole selection if this is part of it. */
  const group = () => {
    const ids = useBoard.getState().selectedIds
    return ids.includes(el.id) ? ids : [el.id]
  }

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
    // Shift+click adds to or removes from the selection
    if (e.shiftKey) return select(el.id, true)
    // pressing a selected element drags the whole selection; any other element becomes the selection
    if (!useBoard.getState().selectedIds.includes(el.id)) select(el.id)
    if (editing) return
    e.currentTarget.focus()
    const ids = group()
    const els = useBoard.getState().elements
    const moving = els.filter((o) => ids.includes(o.id))
    // snap the visible (rotated) outline of what moves to the other elements' edges and centers; Alt moves freely
    const own = boundsOf(moving)
    const others = els.flatMap((o) => (ids.includes(o.id) ? [] : [boundsOf([o])]))
    const setGuides = (guides: Guide[]) => useBoard.setState({ guides })
    checkpoint()
    drag(
      e,
      (dx, dy, ev) => {
        let mx = dx / zoom
        let my = dy / zoom
        if (ev.altKey) setGuides([])
        else {
          const s = snapMove({ ...own, x: own.x + mx, y: own.y + my }, others, SNAP_PX / zoom)
          mx += s.dx
          my += s.dy
          setGuides(s.guides)
        }
        moveMany(Object.fromEntries(moving.map((o) => [o.id, { x: o.x + mx, y: o.y + my }])))
      },
      () => setGuides([]),
    )
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
      update(el.id, { rotation: angleTo(box, (ev.clientX - v.x) / v.zoom, (ev.clientY - v.y) / v.zoom, ev.shiftKey, ev.altKey) }),
    )
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (readOnly && e.key !== 'Enter' && e.key !== 'Escape')) return
    const mod = e.metaKey || e.ctrlKey
    const step = e.shiftKey ? 10 : 1
    if (e.key.startsWith('Arrow') || e.key.toLowerCase() === 'r') checkpoint()
    // Alt+arrows resize from the bottom-right corner, the keyboard twin of the resize handle
    if (e.altKey && e.key.startsWith('Arrow')) {
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
      if (!d) return
      const world = rotateVec(d[0], d[1], el.rotation)
      update(el.id, resize(el, world.x, world.y, el.type === 'image'))
      e.preventDefault()
      return
    }
    // Ctrl+Alt+C / Ctrl+Alt+V copy and paste the look (by key position: Alt changes e.key on some layouts)
    if (mod && e.altKey && (e.code === 'KeyC' || e.code === 'KeyV')) {
      const { copyStyle, pasteStyle } = useBoard.getState()
      if (e.code === 'KeyC') copyStyle(el.id)
      else pasteStyle(group())
      e.preventDefault()
      return
    }
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        remove(group())
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
        const ids = group()
        moveMany(Object.fromEntries(useBoard.getState().elements.filter((o) => ids.includes(o.id)).map((o) => [o.id, { x: o.x + dx, y: o.y + dy }])))
        break
      }
      case 'r':
      case 'R': {
        if (mod) return // Ctrl+R stays reload
        // R rotates 15° clockwise, Shift+R counter-clockwise
        const deg = Math.round((el.rotation + (e.shiftKey ? -15 : 15)) / 15) * 15
        update(el.id, { rotation: ((((deg + 180) % 360) + 360) % 360) - 180 })
        break
      }
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
        duplicate(group())
        break
      default:
        return
    }
    e.preventDefault()
  }

  // bigger grab targets for fingers
  const handle = (matchMedia('(pointer: coarse)').matches ? 24 : 12) / zoom

  return (
    <div
      ref={root}
      role="group"
      tabIndex={0}
      aria-label={label(el)}
      aria-roledescription="board element"
      className={`absolute left-0 top-0 rounded-2xl outline-none ${drop ? 'element-drop' : ''}`}
      style={{
        borderRadius: surface(el).borderRadius,
        opacity: el.opacity,
        width: el.w,
        height: el.h,
        transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
        boxShadow: selected ? `0 0 0 ${2 / zoom}px var(--color-primary)` : undefined,
        cursor: readOnly ? undefined : editing ? 'auto' : 'var(--cursor-move)',
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => e.currentTarget.contains(e.target as Node) && open()}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        // keyboard focus only (Tab): clicks select in onPointerDown, and must not jump the view
        if (e.target !== e.currentTarget || !e.currentTarget.matches(':focus-visible')) return
        if (!useBoard.getState().selectedIds.includes(el.id)) select(el.id)
        panIntoView(el)
      }}
    >
      {el.type === 'image' && (
        <>
          {el.filter === 'duotone' && <DuotoneFilter id={el.id} duo={el.duo ?? DEFAULT_DUO} />}
          <img
            src={el.src}
            alt=""
            draggable={false}
            className="pointer-events-none size-full rounded-2xl object-cover shadow-soft"
            style={{ ...surface(el), filter: el.filter === 'mono' ? 'grayscale(1)' : el.filter === 'duotone' ? `url(#duo-${el.id})` : undefined }}
          />
        </>
      )}

      {el.type === 'note' && (
        <div
          className={`size-full overflow-hidden rounded-2xl bg-card p-4 text-card-foreground shadow-soft ${el.font === 'serif' ? 'font-heading' : ''}`}
          style={{
            ...surface(el),
            fontSize: NOTE_TEXT[el.size ?? 'md'][0],
            lineHeight: `${NOTE_TEXT[el.size ?? 'md'][1]}px`,
            ...(el.bg && { background: el.bg, color: textOn(el.bg) ?? undefined }),
            ...(el.family && FAMILY.test(el.family) && { fontFamily: `"${el.family}", var(--font-sans)` }),
          }}
        >
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
            <p className="whitespace-pre-wrap break-words">{el.text || <span className="opacity-75">Empty note</span>}</p>
          )}
        </div>
      )}

      {el.type === 'color' && (
        <div className="relative size-full rounded-2xl shadow-soft" style={{ ...surface(el), background: el.hex }}>
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
              <Harmonies el={el} />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {el.type === 'link' && <LinkCard el={el} />}

      {el.deco === 'tape' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -top-3 h-6 w-20 -translate-x-1/2 -rotate-3 bg-[rgb(250_244_225/0.75)] shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
        />
      )}
      {el.deco === 'pin' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-2 size-4 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_35%_35%,#f08a76,#c2412d_60%)] shadow-[0_2px_3px_rgb(0_0_0/0.3)]"
        />
      )}

      {solo && !editing && !readOnly && (
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
