import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BoardsMenu } from './BoardsMenu.tsx'
import { Canvas } from './Canvas.tsx'
import { PalettePanel } from './PalettePanel.tsx'
import { normalizeHex } from './colors.ts'
import { fitView } from './geometry.ts'
import { addImages } from './image.ts'
import { addLink, asUrl } from './link.ts'
import { importShared } from './storage.ts'
import { useBoard } from './store.ts'
import { textOn } from './style.ts'
import { Toolbar } from './Toolbar.tsx'

const ARROWS: Record<string, [number, number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

export function App() {
  const empty = useBoard((s) => s.elements.length === 0)
  const notice = useBoard((s) => s.notice)
  const readOnly = useBoard((s) => s.readOnly)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // on a custom background the empty-state text follows its contrast color, like the dots
  const ink = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || undefined)

  // paste images onto the board, a URL as a link card, or plain text as a note
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || useBoard.getState().readOnly) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      const text = e.clipboardData?.getData('text/plain').trim()
      const url = text && asUrl(text)
      const hex = text && /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(text) ? normalizeHex(text) : null
      if (files.length) addImages(files)
      else if (hex) useBoard.getState().add({ type: 'color', hex, w: 140, h: 140 })
      else if (url) addLink(url)
      else if (text) useBoard.getState().add({ type: 'note', text, w: 240, h: 160 })
      else return
      e.preventDefault()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo, Ctrl/Cmd+A select all; text fields keep their native keys
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      // after Ctrl+A or a selection box nothing has focus; Delete, Escape and the arrows still act on the selection
      if (t === document.body && !e.ctrlKey && !e.metaKey) {
        const { selectedIds, elements, remove, select, readOnly, checkpoint, moveMany } = useBoard.getState()
        const arrow = ARROWS[e.key]
        if (e.key === '1') {
          const { elements: all, setView } = useBoard.getState()
          if (all.length) setView(fitView(all, innerWidth, innerHeight))
          return
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly && selectedIds.length) remove(selectedIds)
        else if (e.key === 'Escape') select(null)
        else if (arrow && !e.altKey && !readOnly && selectedIds.length) {
          const step = e.shiftKey ? 10 : 1
          checkpoint()
          moveMany(Object.fromEntries(elements.filter((o) => selectedIds.includes(o.id)).map((o) => [o.id, { x: o.x + arrow[0] * step, y: o.y + arrow[1] * step }])))
          e.preventDefault()
        }
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const { undo, redo, readOnly, elements, selectMany, selectedIds, duplicate } = useBoard.getState()
      if (key === 'a' && !readOnly) selectMany(elements.map((el) => el.id))
      // a focused element duplicates by itself (ElementView); this covers a selection with no focus
      else if (key === 'd' && t === document.body && !readOnly && selectedIds.length) duplicate(selectedIds)
      else if (key === 'z' && !e.shiftKey) undo()
      else if ((key === 'z' && e.shiftKey) || key === 'y') redo()
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => useBoard.getState().notify(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  return (
    <TooltipProvider delay={400}>
      <main>
        <h1 className="sr-only">Lino board</h1>
        {/* the board comes first in the page, and every element on it is a tab stop */}
        <a
          href="#board-tools"
          className="sr-only rounded-full bg-foreground px-4 py-2 text-sm text-background focus:not-sr-only focus:fixed focus:top-4 focus:left-1/2 focus:z-[60] focus:-translate-x-1/2"
        >
          Skip to board tools
        </a>
        <Canvas />
        <div className="fixed top-4 left-4 flex items-center gap-2">
          <a
            href="/"
            aria-label="Lino home"
            className="flex items-center gap-2 rounded-full border bg-card/90 py-1.5 pr-3.5 pl-3 text-sm font-semibold tracking-tight shadow-soft backdrop-blur outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <span aria-hidden className="flex -space-x-1">
              {['bg-foreground/15', 'bg-foreground/35', 'bg-foreground/60', 'bg-foreground'].map((c) => (
                <span key={c} className={`size-2.5 rounded-full ring-2 ring-card ${c}`} />
              ))}
            </span>
            Lino
          </a>
          {!readOnly && <BoardsMenu />}
        </div>
        {readOnly && (
          <p className="fixed left-1/2 top-16 flex sm:top-4 -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border bg-card/90 px-4 py-1.5 text-sm shadow-soft backdrop-blur">
            <span className="text-muted-foreground">Shared board · read-only</span>
            {empty ? (
              <a href="/board/" className="font-medium underline-offset-4 hover:underline">
                Open your board
              </a>
            ) : (
              <button
                type="button"
                disabled={saving}
                className="rounded-full bg-foreground px-3 py-2 font-medium text-background transition-transform outline-none focus-visible:ring-[3px] focus-visible:ring-ring active:scale-[0.97] disabled:opacity-60"
                onClick={() => {
                  // one copy per press: a second click while saving would store the board twice
                  setSaving(true)
                  importShared().then(
                    () => location.assign('/board/'),
                    () => {
                      setSaving(false)
                      useBoard.getState().notify('Could not save it in this browser.')
                    },
                  )
                }}
              >
                {saving ? 'Saving…' : 'Save to my boards'}
              </button>
            )}
          </p>
        )}
        {empty && readOnly && (
          <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
            <div>
              <p className="text-4xl font-semibold tracking-[-0.04em] text-foreground">This board could not be opened</p>
              <p className="mt-2 text-sm text-muted-foreground">Shared links stop working after 90 days. Check the link, or try again in a moment.</p>
            </div>
          </div>
        )}
        {empty && !readOnly && (
          <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
            <div style={{ color: ink }}>
              <p className={`text-4xl font-semibold tracking-[-0.04em] ${ink ? '' : 'text-foreground'}`}>Start with a reference</p>
              <p className={`mt-2 text-sm ${ink ? 'opacity-75' : 'text-muted-foreground'}`}>Drop or paste images or links, or add a note or a color.</p>
            </div>
          </div>
        )}
        {/* above the popovers (z-50): some notices come from inside one */}
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-32 z-[60] flex justify-center">
          {notice && <p className="max-w-md rounded-2xl bg-foreground px-4 py-2 text-center text-sm text-background shadow-lg">{notice}</p>}
        </div>
        {paletteOpen && <PalettePanel onClose={() => setPaletteOpen(false)} />}
        <Toolbar paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((o) => !o)} />
      </main>
    </TooltipProvider>
  )
}
