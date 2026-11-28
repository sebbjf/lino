import { memo, useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { drag, touches } from '../board/drag.ts'
import { elementKey, runElementKey, type ElementKey } from '../board/keys.ts'
import { moveTo, planMove } from '../board/move.ts'
import { openAction } from '../board/open.ts'
import { useSettings } from '../board/settings.ts'
import { panIntoView } from '../board/viewport.ts'
import { angleTo, resize } from '../board/geometry.ts'
import { ColorBody } from '../kinds/ColorBody.tsx'
import { ElementDeco } from '../kinds/ElementDeco.tsx'
import { FrameBody } from '../kinds/FrameBody.tsx'
import { ImageBody } from '../kinds/ImageBody.tsx'
import { LinkBody } from '../kinds/LinkBody.tsx'
import { NoteBody } from '../kinds/NoteBody.tsx'
import { useCrop } from '../kinds/useCrop.ts'
import { targetOf } from '../board/selection.ts'
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

const LABELS = { image: 'Image', note: 'Note', color: 'Color', link: 'Link', frame: 'Frame' }

function label(el: BoardElement) {
  if (el.type === 'frame') return el.title ? `Frame: ${el.title}` : 'Frame'
  if (el.type === 'note' && el.heading) return 'Heading'
  if (el.type === 'color') return `Color ${el.hex}`
  if (el.type === 'link') return `Link: ${el.title ?? new URL(el.url).hostname}`
  return LABELS[el.type]
}

function handleDrag(el: BoardElement, zoom: number) {
  const { update, checkpoint } = useBoard.getState()

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

  return { onResize, onRotate }
}

function Handles({ el, zoom }: { el: BoardElement; zoom: number }) {
  const { onResize, onRotate } = handleDrag(el, zoom)
  // bigger grab targets for fingers
  const handle = (matchMedia('(pointer: coarse)').matches ? HANDLE_PX_COARSE : HANDLE_PX) / zoom

  return (
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
  )
}

function startMove(e: PointerEvent<HTMLDivElement>, el: BoardElement, zoom: number) {
  const { checkpoint, moveMany } = useBoard.getState()
  const plan = planMove(targetOf(el.id), useBoard.getState().elements)
  if (!plan.moving.length) return
  const show = ({ pos, guides }: ReturnType<typeof moveTo>) => {
    useBoard.setState({ guides })
    moveMany(pos)
  }
  checkpoint()
  let pinched = false
  drag(
    e,
    (dx, dy, ev) => {
      if (pinched) return
      // a second finger turns the gesture into a pinch-zoom: put things back and stop dragging
      if (touches.size > 1) {
        pinched = true
        return show(moveTo(plan, 0, 0, 0))
      }
      // Alt moves freely
      const snap = ev.altKey || !useSettings.getState().snap ? 0 : SNAP_PX / zoom
      show(moveTo(plan, dx / zoom, dy / zoom, snap))
    },
    () => useBoard.setState({ guides: [] }),
  )
}

function readElementKey(e: KeyboardEvent<HTMLDivElement>, el: BoardElement, readOnly: boolean, crop: ReturnType<typeof useCrop>): ElementKey | null {
  const { cropping } = crop
  if (e.target !== e.currentTarget || (readOnly && e.key !== 'Enter' && e.key !== 'Escape')) return null
  if (cropping) {
    if (e.key !== 'Enter' && e.key !== 'Escape') return null
    crop.finish(e.key === 'Enter')
    e.stopPropagation()
    e.preventDefault()
    return null
  }
  const action = elementKey(e)
  if (!action || (action.do === 'resize' && el.locked)) return null
  e.preventDefault()
  return action
}

function useElementFocus(root: RefObject<HTMLDivElement | null>, el: BoardElement, solo: boolean, editing: boolean, cropping: boolean) {
  const { select } = useBoard.getState()
  // keep keyboard focus on the selected element (e.g. after duplicate or add)
  useEffect(() => {
    if ((solo || cropping) && !editing && !root.current!.contains(document.activeElement)) root.current!.focus({ preventScroll: true })
  }, [solo, editing, cropping])

  return (e: FocusEvent<HTMLDivElement>) => {
    // keyboard focus only (Tab): clicks select in onPointerDown, and must not jump the view
    if (e.target !== e.currentTarget || !e.currentTarget.matches(':focus-visible')) return
    if (!useBoard.getState().selectedIds.includes(el.id)) select(el.id)
    panIntoView(el)
  }
}

/** A freshly added empty note or untitled frame opens straight into editing. */
function startsEditing(el: BoardElement, selected: boolean) {
  return selected && ((el.type === 'note' && !el.text) || (el.type === 'frame' && !el.title))
}

/** `solo`: the only selected element, which gets handles and keyboard focus. */
type Props = { el: BoardElement; selected: boolean; solo: boolean; zoom: number }

/** One element on the board: position, selection, drag, resize/rotate, keys and focus. What it shows is its kind's body (kinds/*Body.tsx). */
export const ElementView = memo(function ElementView({ el, selected, solo, zoom }: Props) {
  const { select, checkpoint, setCropId } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  // the selection outline follows the board background's contrast color, so it shows on dark boards too
  const outline = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || 'var(--color-primary)')
  // the ink of the board (frames and headings draw in it, not on a card)
  const ink = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || 'var(--foreground)')
  const [editing, setEditing] = useState(() => startsEditing(el, selected))
  const [pickerOpen, setPickerOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const crop = useCrop(el, root)
  const { cropping } = crop
  // plays once, for an element just added in messy mode
  const [drop] = useState(() => justDropped.delete(el.id))

  const onFocus = useElementFocus(root, el, solo, editing, cropping)

  const open = () => {
    const action = openAction(el, readOnly)
    switch (action.kind) {
      case 'crop':
        return setCropId(el.id)
      case 'edit':
        checkpoint()
        return setEditing(true)
      case 'picker':
        checkpoint()
        return setPickerOpen(true)
      case 'url':
        window.open(action.url, '_blank', 'noopener,noreferrer')
    }
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
    startMove(e, el, zoom)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const action = readElementKey(e, el, readOnly, crop)
    if (!action || runElementKey(action, el)) return
    switch (action.do) {
      case 'open':
        return open()
      case 'escape':
        if (pickerOpen) return setPickerOpen(false)
        select(null)
        return e.currentTarget.blur()
    }
  }

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
      onFocus={onFocus}
    >
      {el.type === 'frame' && <FrameBody el={el} zoom={zoom} ink={ink} editing={editing} setEditing={setEditing} />}
      {el.type === 'image' && <ImageBody el={el} zoom={zoom} crop={crop} />}
      {el.type === 'note' && <NoteBody el={el} ink={ink} editing={editing} setEditing={setEditing} />}
      {el.type === 'color' && <ColorBody el={el} root={root} pickerOpen={pickerOpen} setPickerOpen={setPickerOpen} />}
      {el.type === 'link' && <LinkBody el={el} />}

      <ElementDeco el={el} zoom={zoom} />

      {solo && !editing && !readOnly && !el.locked && !cropping && (
        <Handles el={el} zoom={zoom} />
      )}
    </div>
  )
})
