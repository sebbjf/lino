import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App.tsx'
import { loadBoard, startAutosave } from './storage.ts'
import { useBoard } from './store.ts'
import './index.css'

// load before rendering and autosaving, so an empty first render never overwrites the saved board
await loadBoard().catch(() => useBoard.getState().notify('Saved board could not be loaded; changes may not be kept.'))
startAutosave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
