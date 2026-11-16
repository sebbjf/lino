import { Component, StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { exportBoardFile } from './boardFile.ts'
import { Button } from './components/ui/button.tsx'
import { loadShared, sharedId } from './share.ts'
import { loadBoard, startAutosave } from './storage.ts'
import { useBoard } from './store.ts'
import './index.css'

const shared = sharedId()
if (shared) {
  // a shared board never touches the local one
  await loadShared(shared).catch((e: Error) => useBoard.setState({ readOnly: true, notice: e.message }))
} else {
  // load before rendering and autosaving, so an empty first render never overwrites the saved board
  // no autosave after a failed load: it would write this empty board over the saved ones
  await loadBoard().then(startAutosave, () => useBoard.getState().notify('Saved boards could not be loaded, so changes will not be kept. Reload to try again.'))
}

/** A render error shows a way out instead of a blank page. */
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="grid min-h-dvh place-items-center px-4 text-center">
        <div>
          <h1 className="text-4xl font-semibold tracking-[-0.04em]">This board stopped working</h1>
          <p className="mt-2 text-sm text-muted-foreground">Export a copy to be safe, then reload the page.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={exportBoardFile}>Export board</Button>
            <Button variant="outline" onClick={() => location.reload()}>
              Reload
            </Button>
          </div>
        </div>
      </main>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
