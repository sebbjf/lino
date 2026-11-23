import { useBoard, type BoardElement } from '../board/store.ts'
import { surface } from '../board/style.ts'

/** Width of the frame's grabbable edge, in screen px. */
const EDGE_PX = 10
const EDGES = ['left-0 top-0 w-full', 'bottom-0 left-0 w-full', 'left-0 top-0 h-full', 'right-0 top-0 h-full'] as const

type Props = { el: Extract<BoardElement, { type: 'frame' }>; zoom: number; ink: string; editing: boolean; setEditing: (v: boolean) => void }

/** A hollow tinted rectangle with its title above the top-left corner. */
export function FrameBody({ el, zoom, ink, editing, setEditing }: Props) {
  const { update } = useBoard.getState()
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 border"
        style={{ ...surface(el), boxShadow: 'none', background: `color-mix(in srgb, ${ink} 6%, transparent)`, borderColor: `color-mix(in srgb, ${ink} 25%, transparent)` }}
      />
      {EDGES.map((side, i) => (
        <div key={side} aria-hidden className={`pointer-events-auto absolute ${side}`} style={{ [i < 2 ? 'height' : 'width']: EDGE_PX / zoom }} />
      ))}
      <div className="pointer-events-auto absolute bottom-full left-0 mb-1 origin-bottom-left" style={{ transform: `scale(${1 / zoom})`, color: ink }}>
        {editing ? (
          <input
            autoFocus
            aria-label="Frame title"
            className="w-56 rounded bg-card/90 px-1 text-sm font-medium text-card-foreground outline-none"
            value={el.title}
            maxLength={100}
            placeholder="Frame title"
            onChange={(e) => update(el.id, { title: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => (e.key === 'Escape' || e.key === 'Enter') && e.currentTarget.blur()}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="block max-w-56 truncate px-1 text-sm font-medium">{el.title || <span className="opacity-60">Untitled frame</span>}</span>
        )}
      </div>
    </>
  )
}
