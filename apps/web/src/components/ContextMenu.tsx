import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Kbd } from '@/components/ui/kbd'
import { available, commands, iconOf } from '../board/commands.ts'

// Same commands as the command menu and the toolbars, picked by id: nothing is defined twice.
const ON_ELEMENTS = ['duplicate', 'forward', 'backward', 'group', 'ungroup', 'lock', 'frame-selection', 'swatches', 'delete']
const ON_BOARD = ['add-note', 'add-heading', 'add-frame', 'add-color', 'add-image', 'select-all', 'undo', 'redo', 'fit']

export type MenuAt = { x: number; y: number; /** the same spot in board coordinates */ board: { x: number; y: number }; onElement: boolean }

/** Right click on the board: what you can do with the selection, or what you can add here. */
export function ContextMenu({ at, onClose }: { at: MenuAt; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: at.x, y: at.y })
  const ids = at.onElement ? ON_ELEMENTS : ON_BOARD
  const items = available(commands.filter((c) => ids.includes(c.id))).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))

  // keep it on screen
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect()
    setPos({ x: Math.max(8, Math.min(at.x, innerWidth - r.width - 8)), y: Math.max(8, Math.min(at.y, innerHeight - r.height - 8)) })
    ref.current!.querySelector<HTMLButtonElement>('button')?.focus()
  }, [at])

  useEffect(() => {
    const away = (e: Event) => !ref.current?.contains(e.target as Node) && onClose()
    const esc = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('pointerdown', away, true)
    addEventListener('wheel', onClose, { passive: true })
    addEventListener('resize', onClose)
    addEventListener('keydown', esc)
    return () => {
      removeEventListener('pointerdown', away, true)
      removeEventListener('wheel', onClose)
      removeEventListener('resize', onClose)
      removeEventListener('keydown', esc)
    }
  }, [onClose])

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    all[(i + (e.key === 'ArrowDown' ? 1 : -1) + all.length) % all.length].focus()
    e.preventDefault()
  }

  if (!items.length) return null
  return (
    <div
      ref={ref}
      role="menu"
      aria-label={at.onElement ? 'Selection' : 'Board'}
      onKeyDown={move}
      onContextMenu={(e) => e.preventDefault()}
      // the menu sits inside the canvas: a press here must not reach it (it would deselect and pan)
      onPointerDown={(e) => e.stopPropagation()}
      className="fixed z-50 flex w-64 flex-col gap-0.5 rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-soft"
      style={{ left: pos.x, top: pos.y }}
    >
      {items.map((c) => (
        <button
          key={c.id}
          role="menuitem"
          className="flex items-center gap-3 rounded-xl px-3 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"
          onClick={() => {
            onClose()
            c.run(at.board)
          }}
        >
          <HugeiconsIcon icon={iconOf(c)} strokeWidth={1.8} className="size-4" />
          <span className="flex-1">{c.label}</span>
          {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
        </button>
      ))}
    </div>
  )
}
