import type { ColorMeta } from './colors.ts'
import { useBoard, type BoardElement, type View } from './store.ts'

// One local board for now; key it by board id when there are several.
const KEY = 'local'
type Saved = { elements: BoardElement[]; view: View; colorMeta?: Record<string, ColorMeta> }

let dbPromise: Promise<IDBDatabase> | undefined
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('lino', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('boards')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const store = (await db()).transaction('boards', mode).objectStore('boards')
  return new Promise((resolve, reject) => {
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadBoard() {
  const saved = await run<Saved | undefined>('readonly', (s) => s.get(KEY))
  if (!saved) return
  // a link still loading when the tab closed will never finish
  const elements = saved.elements.map((e) =>
    e.type === 'link' && e.status === 'loading' ? { ...e, status: 'error' as const, error: 'Reading was interrupted.' } : e,
  )
  useBoard.setState({ elements, view: saved.view, colorMeta: saved.colorMeta ?? {} })
}

function save() {
  const { elements, view, colorMeta } = useBoard.getState()
  return run('readwrite', (s) => s.put({ elements, view, colorMeta } satisfies Saved, KEY)).catch(() =>
    useBoard.getState().notify('Could not save the board in this browser.'),
  )
}

/** Debounced save on every board change, plus an immediate save when the tab is hidden. */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined
  useBoard.subscribe((s, prev) => {
    if (s.elements === prev.elements && s.view === prev.view && s.colorMeta === prev.colorMeta) return
    clearTimeout(timer)
    timer = setTimeout(save, 300)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer)
      save()
    }
  })
}
