import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
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
  await loadBoard().catch(() => useBoard.getState().notify('Saved board could not be loaded; changes may not be kept.'))
  startAutosave()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
