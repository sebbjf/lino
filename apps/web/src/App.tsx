import { useEffect, useState } from 'react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BoardsMenu } from './components/BoardsMenu.tsx'
import { CommandMenu } from './components/CommandMenu.tsx'
import { Canvas } from './components/Canvas.tsx'
import { SettingsMenu } from './components/SettingsMenu.tsx'
import { PalettePanel } from './components/PalettePanel.tsx'
import { runCommand, SIZE } from './board/commands.ts'
import { addImages } from './data/image.ts'
import { boardKey } from './board/keys.ts'
import { addLink } from './board/link.ts'
import { pasteAction } from './board/paste.ts'
import { captureSnapshot } from './data/snapshot.ts'
import { nudge } from './board/selection.ts'
import { saveAsLocalBoard } from './data/storage.ts'
import { useBoard } from './board/store.ts'
import { textOn } from './board/style.ts'
import { Toolbar } from './components/Toolbar.tsx'
import { OverwriteDialog } from './components/OverwriteDialog.tsx'

export function App() {
  const empty = useBoard((s) => s.elements.length === 0)
  const notice = useBoard((s) => s.notice)
  const readOnly = useBoard((s) => s.readOnly)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [commandsOpen, setCommandsOpen] = useState(false)

  // paste images onto the board, a URL as a link card, or plain text as a note
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]') || useBoard.getState().readOnly) return
      const action = pasteAction(e.clipboardData?.getData('text/plain'), e.clipboardData?.files ?? [])
      if (!action) return
      switch (action.type) {
        case 'images':
          addImages(action.files)
          break
        case 'color':
          useBoard.getState().add({ ...action, ...SIZE.color })
          break
        case 'link':
          addLink(action.url)
          break
        case 'note':
          useBoard.getState().add({ ...action, ...SIZE.pastedText })
          break
      }
      e.preventDefault()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Text fields keep their native shortcuts except for saving the board.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const { selectedIds, select } = useBoard.getState()
      const action = boardKey(e, t === document.body, selectedIds.length > 0)
      if (!action) return
      if (action.id !== 'save' && action.id !== 'save-as' && t.closest('input, textarea, [contenteditable]')) return
      if (action.preventDefault) e.preventDefault()
      if (action.id === 'nudge') nudge(selectedIds, ...action.delta)
      else if (action.id === 'clear-selection') select(null)
      else runCommand(action.id)
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
          <SettingsMenu />
        </div>
        <ReadOnlyBanner readOnly={readOnly} empty={empty} />
        {empty && <EmptyBoard readOnly={readOnly} />}
        {/* above the popovers (z-50): some notices come from inside one */}
        <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-32 z-[60] flex justify-center">
          {notice && <p className="max-w-md rounded-2xl bg-foreground px-4 py-2 text-center text-sm text-background shadow-lg">{notice}</p>}
        </div>
        <CommandMenu open={commandsOpen} setOpen={setCommandsOpen} />
        <OverwriteDialog />
        {paletteOpen && <PalettePanel onClose={() => setPaletteOpen(false)} />}
        <Toolbar onOpenCommands={() => setCommandsOpen(true)} paletteOpen={paletteOpen} onTogglePalette={() => setPaletteOpen((o) => !o)} />
      </main>
    </TooltipProvider>
  )
}

function ReadOnlyBanner({ readOnly, empty }: { readOnly: boolean; empty: boolean }) {
  const [saving, setSaving] = useState(false)
  if (!readOnly) return null
  return (
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
            saveAsLocalBoard(captureSnapshot(), 'Shared board').then(
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
  )
}

function EmptyBoard({ readOnly }: { readOnly: boolean }) {
  // on a custom background the empty-state text follows its contrast color, like the dots
  const ink = useBoard((s) => (s.board.bg && textOn(s.board.bg)) || undefined)
  return readOnly ? (
    <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
      <div>
        <p className="text-4xl font-semibold tracking-[-0.04em] text-foreground">This board could not be opened</p>
        <p className="mt-2 text-sm text-muted-foreground">Shared links stop working after 90 days. Check the link, or try again in a moment.</p>
      </div>
    </div>
  ) : (
    <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
      <div style={{ color: ink }}>
        <p className={`text-4xl font-semibold tracking-[-0.04em] ${ink ? '' : 'text-foreground'}`}>Start with a reference</p>
        <p className={`mt-2 text-sm ${ink ? 'opacity-75' : 'text-muted-foreground'}`}>Drop or paste images or links, or add a note or a color.</p>
      </div>
    </div>
  )
}
