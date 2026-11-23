import { useEffect, useRef } from 'react'
import { useBoard, type BoardElement } from '../board/store.ts'
import { loadFamily, noteFontStack, noteText as noteSizes, surface } from '../board/style.ts'
import { CARD_PAD, isBare, noteInk } from './look.ts'

type Props = { el: Extract<BoardElement, { type: 'note' }>; ink: string; editing: boolean; setEditing: (v: boolean) => void }

export function NoteBody({ el, ink, editing, setEditing }: Props) {
  const { update } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  const text = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    if (el.family) loadFamily(el.family)
  }, [el.family])

  // a note grows to fit its text (it never shrinks by itself): no inner scrolling, nothing cut off
  useEffect(() => {
    const p = text.current
    if (!p || readOnly) return
    const grow = () => {
      const need = p.offsetHeight + CARD_PAD * 2
      const cur = useBoard.getState().elements.find((o) => o.id === el.id)
      if (cur && need > cur.h + 0.5) update(el.id, { h: need })
    }
    grow()
    const ro = new ResizeObserver(grow)
    ro.observe(p)
    return () => ro.disconnect()
  }, [el.id, el.w, readOnly, update])

  return (
    <div
      className={`size-full overflow-hidden rounded-2xl ${isBare(el) ? '' : 'bg-card text-card-foreground shadow-soft'}`}
      style={{
        ...surface(el),
        padding: CARD_PAD,
        fontFamily: noteFontStack(el),
        fontSize: noteSizes(el)[0],
        lineHeight: `${noteSizes(el)[1]}px`,
        textAlign: el.align,
        fontWeight: el.bold ? 700 : undefined,
        fontStyle: el.italic ? 'italic' : undefined,
        color: noteInk(el, ink),
        ...(el.bg && { background: el.bg }),
      }}
    >
      {/* the text sizes the note: a hidden copy of it (and the textarea laid over it) tell how tall it must be; a zero-width space keeps a trailing newline's line */}
      <div className="grid">
        <p ref={text} className={`[grid-area:1/1] whitespace-pre-wrap break-words ${editing ? 'invisible' : ''}`}>
          {el.text ? `${el.text}​` : editing ? '​' : <span className="opacity-75">Empty note</span>}
        </p>
        {editing && (
          <textarea
            autoFocus
            aria-label="Note text"
            className="[grid-area:1/1] size-full resize-none select-text overflow-hidden bg-transparent outline-none [font:inherit] [text-align:inherit]"
            value={el.text}
            placeholder="Write something…"
            onChange={(e) => update(el.id, { text: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  )
}
