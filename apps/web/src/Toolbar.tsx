import { useRef, type ReactNode } from 'react'
import { zoomAt } from './geometry.ts'
import { addImages } from './image.ts'
import { useBoard } from './store.ts'

function Button({ label, shortcut, onClick, children }: { label: string; shortcut?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      aria-keyshortcuts={shortcut}
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-sm text-stone-700 transition-colors hover:bg-stone-100 focus-visible:outline-2 focus-visible:outline-[var(--color-focus)]"
    >
      {children}
    </button>
  )
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px bg-stone-200" />

export function Toolbar() {
  const selectedId = useBoard((s) => s.selectedId)
  const zoom = useBoard((s) => s.view.zoom)
  const { add, duplicate, reorder, remove } = useBoard.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const zoomTo = (z: number) => {
    const { view, setView } = useBoard.getState()
    setView(zoomAt(view, window.innerWidth / 2, window.innerHeight / 2, z))
  }

  return (
    <div
      role="toolbar"
      aria-label="Board tools"
      className="fixed bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center overflow-x-auto rounded-full border border-stone-200 bg-white/90 p-1 shadow-lg shadow-stone-900/5 backdrop-blur"
    >
      <Button label="Add image" onClick={() => fileInput.current?.click()}>Image</Button>
      <Button label="Add note" onClick={() => add({ type: 'note', text: '', w: 220, h: 140 })}>Note</Button>
      <Button label="Add color" onClick={() => add({ type: 'color', hex: '#d6c7b4', w: 140, h: 140 })}>Color</Button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addImages([...(e.target.files ?? [])])
          e.target.value = ''
        }}
      />

      {selectedId && (
        <>
          <Divider />
          <Button label="Duplicate" shortcut="Control+D" onClick={() => duplicate(selectedId)}>Duplicate</Button>
          <Button label="Bring forward" shortcut="]" onClick={() => reorder(selectedId, 'forward')}>Forward</Button>
          <Button label="Send backward" shortcut="[" onClick={() => reorder(selectedId, 'backward')}>Backward</Button>
          <Button label="Delete" shortcut="Delete" onClick={() => remove(selectedId)}>Delete</Button>
        </>
      )}

      <Divider />
      <Button label="Zoom out" onClick={() => zoomTo(zoom / 1.25)}>−</Button>
      <Button label="Reset zoom" onClick={() => zoomTo(1)}>
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
      </Button>
      <Button label="Zoom in" onClick={() => zoomTo(zoom * 1.25)}>+</Button>
    </div>
  )
}
