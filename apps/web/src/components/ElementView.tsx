import { memo, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { arrowDelta } from '../board/commands.ts'
import { drag, touches } from '../board/drag.ts'
import { movingSet } from '../board/frames.ts'
import { useSettings } from '../board/settings.ts'
import { panIntoView } from '../board/viewport.ts'
import { angleTo, boundsOf, resize, rotateVec, snapMove } from '../board/geometry.ts'
import type { Guide } from '../board/geometry.ts'
import { ColorBody } from '../kinds/ColorBody.tsx'
import { ElementDeco } from '../kinds/ElementDeco.tsx'
import { FrameBody } from '../kinds/FrameBody.tsx'
import { ImageBody } from '../kinds/ImageBody.tsx'
import { LinkBody } from '../kinds/LinkBody.tsx'
import { NoteBody } from '../kinds/NoteBody.tsx'
import { useCrop } from '../kinds/useCrop.ts'
import { duplicate, frameSelection, group, nudge, remove, reorder, rotateStep, targetOf, ungroup } from '../board/selection.ts'
import { justDropped, useBoard, type BoardElement } from '../board/store.ts'
import { surface, textOn } from '../board/style.ts'

/** Snap distance in screen pixels. */
const SNAP_PX = 6
/** Resize/rotate handle diameter in screen px: bigger for fingers. */
const HANDLE_PX = 12
const HANDLE_PX_COARSE = 32
/** How far above the top edge the rotate handle sits, in screen px. */
const ROTATE_OFFSET_PX = 28
/** Border width of the handles, and thickness of the selection ring, in screen px. */
const HANDLE_BORDER_PX = 1.5
const SELECT_RING_PX = 2
/** Arrow-key distance in board px, with and without Shift. */
const NUDGE = 1
const NUDGE_BIG = 10

const LABELS = { image: 'Image', note: 'Note', color: 'Color', link: 'Link', frame: 'Frame' }

function label(el: BoardElement) {
  if (el.type === 'frame') return el.title ? `Frame: ${el.title}` : 'Frame'
  if (el.type === 'note' && el.heading) return 'Heading'
  if (el.type === 'color') return `Color ${el.hex}`
  if (el.type === 'link') return `Link: ${el.title ?? new URL(el.url).hostname}`
  return LABELS[el.type]
}

/** `solo`: the only selected element, which gets handles and keyboard focus. */
type Props = { el: BoardElement; selected: boolean; solo: boolean; zoom: number }

/** One element on the board: position, selection, drag, resize/rotate, keys and focus. What it shows is its kind's body (kinds/*Body.tsx). */
export const ElementView = memo(function ElementView({ el, selected, solo, zoom }: Props) {
  const { update, moveMany, select, checkpoint, setCropId } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  // the selection outline follows the board background's contrast color, so it shows on dark boards too
  const outline = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || 'var(--color-primary)')
  // the ink of the board (frames and headings draw in it, not on a card)
  const ink = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || 'var(--foreground)')
  // a freshly added empty note or untitled frame opens straight into editing
  const [editing, setEditing] = useState(() => selected && ((el.type === 'note' && !el.text) || (el.type === 'frame' && !el.title)))
  const [pickerOpen, setPickerOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const crop = useCrop(el, root)
  const { cropping } = crop
  // plays once, for an element just added in messy mode
  const [drop] = useState(() => justDropped.delete(el.id))

  // keep keyboard focus on the selected element (e.g. after duplicate or add)
  useEffect(() => {
    if ((solo || cropping) && !editing && !root.current!.contains(document.activeElement)) root.current!.focus({ preventScroll: true })
  }, [solo, editing, cropping])

  const open = () => {
    if ((readOnly || el.locked) && el.type !== 'link') return
    if (el.type === 'image') return setCropId(el.id)
    if (el.type !== 'link') checkpoint()
    if (el.type === 'note' || el.type === 'frame') setEditing(true)
    if (el.type === 'color') setPickerOpen(true)
    if (el.type === 'link') window.open(el.url, '_blank', 'noopener,noreferrer')
  }

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // React bubbles events from portals (the colour popover) through here; ignore those
    // read-only: let the press reach the canvas so it pans
    if (readOnly || e.button !== 0 || !e.currentTarget.contains(e.target as Node)) return
    e.stopPropagation()
    if (cropping) return
    // Shift+click adds to or removes from the selection
    if (e.shiftKey) {
      select(el.id, true)
      // taken out of the selection: drop its focus too, or Delete and the arrows would still act on it
      if (!useBoard.getState().selectedIds.includes(el.id)) e.currentTarget.blur()
      return
    }
    // pressing a selected element drags the whole selection; any other element becomes the selection
    if (!useBoard.getState().selectedIds.includes(el.id)) select(el.id)
    if (editing) return
    e.currentTarget.focus()
    const ids = targetOf(el.id)
    const els = useBoard.getState().elements
    // a dragged frame takes what lies inside it (at drag start) along; locked elements, and groups holding one, stay
    const moving = movingSet(ids, els)
    const carried = new Set([...ids, ...moving.map((o) => o.id)])
    if (!moving.length) return
    // snap the visible (rotated) outline of what moves to the other elements' edges and centers; Alt moves freely
    const own = boundsOf(moving)
    const others = els.flatMap((o) => (carried.has(o.id) ? [] : [boundsOf([o])]))
    const setGuides = (guides: Guide[]) => useBoard.setState({ guides })
    checkpoint()
    let pinched = false
    drag(
      e,
      (dx, dy, ev) => {
        // a second finger turns the gesture into a pinch-zoom: put things back and stop dragging
        if (!pinched && touches.size > 1) {
          pinched = true
          setGuides([])
          moveMany(Object.fromEntries(moving.map((o) => [o.id, { x: o.x, y: o.y }])))
        }
        if (pinched) return
        let mx = dx / zoom
        let my = dy / zoom
        if (ev.altKey || !useSettings.getState().snap) setGuides([])
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
    const step = e.shiftKey ? NUDGE_BIG : NUDGE
    if (cropping) {
      if (e.key !== 'Enter' && e.key !== 'Escape') return
      crop.finish(e.key === 'Enter')
      e.stopPropagation()
      e.preventDefault()
      return
    }
    // Alt+arrows resize from the bottom-right corner, the keyboard twin of the resize handle
    if (e.altKey && e.key.startsWith('Arrow')) {
      if (el.locked) return
      checkpoint()
      const d = arrowDelta(e.key, step)
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
      else pasteStyle(targetOf(el.id))
      e.preventDefault()
      return
    }
    if (mod && e.altKey && e.code === 'KeyF') {
      frameSelection(targetOf(el.id))
      e.preventDefault()
      return
    }
    switch (e.key) {
      case 'g':
      case 'G':
        if (!mod) return
        // Ctrl+G groups the selection, Ctrl+Shift+G takes it apart
        if (e.shiftKey) ungroup(targetOf(el.id))
        else group(targetOf(el.id))
        break
      case 'Delete':
      case 'Backspace':
        remove(targetOf(el.id))
        break
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        nudge(targetOf(el.id), ...arrowDelta(e.key, step)!)
        break
      }
      case 'r':
      case 'R': {
        if (mod) return // Ctrl+R stays reload
        // R rotates 15° clockwise, Shift+R counter-clockwise
        rotateStep(targetOf(el.id), e.shiftKey ? -1 : 1)
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
        duplicate(targetOf(el.id))
        break
      default:
        return
    }
    e.preventDefault()
  }

  // bigger grab targets for fingers
  const handle = (matchMedia('(pointer: coarse)').matches ? HANDLE_PX_COARSE : HANDLE_PX) / zoom

  return (
    <div
      ref={root}
      role="group"
      data-id={el.id}
      tabIndex={0}
      aria-label={el.locked ? `${label(el)}, locked` : label(el)}
      aria-roledescription="board element"
      // a frame is hollow: only its title and edges take the pointer, so the board inside it stays reachable
      className={`absolute left-0 top-0 rounded-2xl outline-none ${drop ? 'element-drop' : ''} ${el.type === 'frame' ? 'pointer-events-none' : ''}`}
      style={{
        borderRadius: surface(el).borderRadius,
        opacity: el.opacity,
        width: el.w,
        height: el.h,
        transform: `translate(${el.x}px, ${el.y}px) rotate(${el.rotation}deg)`,
        boxShadow: selected ? `0 0 0 ${SELECT_RING_PX / zoom}px ${outline}` : undefined,
        cursor: readOnly || el.locked ? undefined : editing ? 'auto' : 'var(--cursor-move)',
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
      {el.type === 'frame' && <FrameBody el={el} zoom={zoom} ink={ink} editing={editing} setEditing={setEditing} />}
      {el.type === 'image' && <ImageBody el={el} zoom={zoom} crop={crop} />}
      {el.type === 'note' && <NoteBody el={el} ink={ink} editing={editing} setEditing={setEditing} />}
      {el.type === 'color' && <ColorBody el={el} root={root} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} />}
      {el.type === 'link' && <LinkBody el={el} />}

      <ElementDeco el={el} zoom={zoom} />

      {solo && !editing && !readOnly && !el.locked && !cropping && (
        <>
          {el.type !== 'frame' && (
            <div
              aria-hidden
              className="absolute left-1/2 rounded-full border-ring bg-card"
              style={{ width: handle, height: handle, top: -ROTATE_OFFSET_PX / zoom, marginLeft: -handle / 2, borderWidth: HANDLE_BORDER_PX / zoom, cursor: 'grab' }}
              onPointerDown={onRotate}
            />
          )}
          <div
            aria-hidden
            className="pointer-events-auto absolute rounded-full border-ring bg-card"
            style={{ width: handle, height: handle, right: -handle / 2, bottom: -handle / 2, borderWidth: HANDLE_BORDER_PX / zoom, cursor: 'nwse-resize' }}
            onPointerDown={onResize}
          />
        </>
      )}
    </div>
  )
})
