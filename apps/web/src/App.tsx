import { useEffect } from 'react'
import { Canvas } from './Canvas.tsx'
import { addImages } from './image.ts'
import { useBoard } from './store.ts'
import { Toolbar } from './Toolbar.tsx'

export function App() {
  const empty = useBoard((s) => s.elements.length === 0)
  const notice = useBoard((s) => s.notice)

  // paste images onto the board, or plain text as a note
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, [contenteditable]')) return
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
      const text = e.clipboardData?.getData('text/plain').trim()
      if (files.length) addImages(files)
      else if (text) useBoard.getState().add({ type: 'note', text, w: 240, h: 160 })
      else return
      e.preventDefault()
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z or Ctrl+Y redo; text fields keep their native undo
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
      const key = e.key.toLowerCase()
      const { undo, redo } = useBoard.getState()
      if (key === 'z' && !e.shiftKey) undo()
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
    <main>
      <h1 className="sr-only">Lino board</h1>
      <Canvas />
      {empty && (
        <div className="pointer-events-none fixed inset-0 grid place-items-center px-4 text-center">
          <div>
            <p className="font-serif text-3xl text-stone-800">Start with a reference</p>
            <p className="mt-2 text-sm text-stone-500">Drop or paste images, or add a note or a color.</p>
          </div>
        </div>
      )}
      <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 -translate-x-1/2">
        {notice && <p className="rounded-full bg-stone-800 px-4 py-2 text-sm text-white shadow-lg">{notice}</p>}
      </div>
      <Toolbar />
    </main>
  )
}
