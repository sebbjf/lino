import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Canvas } from './Canvas.tsx'
import { PalettePanel } from './PalettePanel.tsx'
import { addImages } from './image.ts'
import { addLink, asUrl } from './link.ts'
import { useBoard } from './store.ts'
import { Toolbar } from './Toolbar.tsx'

export function App() {
  const empty = useBoard((s) => s.elements.length === 0)
  const notice = useBoard((s) => s.notice)
  const readOnly = useBoard((s) => s.readOnly)
  const [paletteOpen, setPaletteOpen] = useState(false)

  // paste images onto the board, a URL as a link card, or plain text as a note
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || useBoard.getState().readOnly) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      const text = e.clipboardData?.getData('text/plain').trim()
      const url = text && asUrl(text)
      if (files.length) addImages(files)
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
      // after Ctrl+A or a selection box nothing has focus; Delete and Escape still act on the selection
      if (t === document.body && !e.ctrlKey && !e.metaKey) {
        const { selectedIds, remove, select, readOnly } = useBoard.getState()
        if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly && selectedIds.length) remove(selectedIds)
        else if (e.key === 'Escape') select(null)
        return
      }
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      const { undo, redo, readOnly, elements, selectMany } = useBoard.getState()
      if (key === 'a' && !readOnly) selectMany(elements.map((el) => el.id))
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
        <Canvas />
        <a
          href="/"
          aria-label="Lino home"
          className="fixed top-4 left-4 flex items-center gap-2 rounded-full border bg-card/90 py-1.5 pr-3.5 pl-3 text-sm font-semibold tracking-tight shadow-soft backdrop-blur outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <span aria-hidden className="flex -space-x-1">
            {['bg-foreground/15', 'bg-foreground/35', 'bg-foreground/60', 'bg-foreground'].map((c) => (
              <span key={c} className={`size-2.5 rounded-full ring-2 ring-card ${c}`} />
            ))}
          </span>
          Lino
        </a>
        {readOnly && (
          <p className="fixed left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full border bg-card/90 px-4 py-1.5 text-sm shadow-soft backdrop-blur">
            <span className="text-muted-foreground">Shared board · read-only</span>
            <a href="/board/" className="font-medium underline-offset-4 hover:underline">
              Open your board
            </a>
          </p>
        )}
        {empty && readOnly && (
          <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
            <p className="text-4xl font-semibold tracking-[-0.04em] text-foreground">This board could not be opened</p>
          </div>
        )}
        {empty && !readOnly && (
          <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
            <div>
              <p className="text-4xl font-semibold tracking-[-0.04em] text-foreground">Start with a reference</p>
              <p className="mt-2 text-sm text-muted-foreground">Drop or paste images or links, or add a note or a color.</p>
            </div>
          </div>
        )}
        <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 -translate-x-1/2">
          {notice && <p className="rounded-full bg-foreground px-4 py-2 text-sm text-background shadow-lg">{notice}</p>}
        </div>
        {paletteOpen && <PalettePanel onClose={() => setPaletteOpen(false)} />}
        <Toolbar paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((o) => !o)} />
      </main>
    </TooltipProvider>
  )
}
