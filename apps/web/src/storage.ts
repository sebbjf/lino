import type { ColorMeta } from './colors.ts'
import { fitView } from './geometry.ts'
import { useBoard, type BoardElement, type BoardMeta, type ExportPrefs, type View } from './store.ts'
import type { BoardStyle } from './style.ts'

// Many local boards: each is stored under its own id ('local' is the original single board), plus an index of names.
const INDEX = 'index'
type Index = { current: string; boards: BoardMeta[] }
type Saved = { elements: BoardElement[]; view: View; colorMeta?: Record<string, ColorMeta>; board?: BoardStyle; exportPrefs?: ExportPrefs }

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

/** Puts a saved board on screen (a clean slate for undo and selection). */
function show(id: string, saved: Saved | undefined) {
  // a link still loading when the tab closed will never finish
  const elements = (saved?.elements ?? []).map((e) =>
    e.type === 'link' && e.status === 'loading' ? { ...e, status: 'error' as const, error: 'Reading was interrupted.' } : e,
  )
  const view = saved?.view ?? { x: 0, y: 0, zoom: 1 }
  // a phone opens a board made on a desktop zoomed to fit, instead of cropped to its top-left
  const untouched = view.x === 0 && view.y === 0 && view.zoom === 1
  useBoard.setState((s) => ({
    boardId: id,
    elements,
    view: innerWidth < 700 && elements.length && untouched ? fitView(elements, innerWidth, innerHeight, 24) : view,
    colorMeta: saved?.colorMeta ?? {},
    board: saved?.board ?? {},
    exportPrefs: saved?.exportPrefs ?? s.exportPrefs,
    selectedIds: [],
    past: [],
    future: [],
    guides: [],
  }))
}

export async function loadBoard() {
  const index = await run<Index | undefined>('readonly', (s) => s.get(INDEX))
  if (index?.boards.length) {
    const current = index.boards.find((b) => b.id === index.current) ?? index.boards[0]
    useBoard.setState({ boards: index.boards })
    show(current.id, await run<Saved | undefined>('readonly', (s) => s.get(current.id)))
  } else {
    // first run, or a board saved before there were several
    show('local', await run<Saved | undefined>('readonly', (s) => s.get('local')))
  }
}

function save() {
  const { elements, view, colorMeta, board, exportPrefs, boards, boardId } = useBoard.getState()
  return Promise.all([
    run('readwrite', (s) => s.put({ elements, view, colorMeta, board, exportPrefs } satisfies Saved, boardId)),
    run('readwrite', (s) => s.put({ current: boardId, boards } satisfies Index, INDEX)),
  ]).catch(() => useBoard.getState().notify('Could not save the board in this browser.'))
}

/** Saves the board on screen now, then shows another one. */
export async function switchBoard(id: string) {
  if (id === useBoard.getState().boardId) return
  await save()
  show(id, await run<Saved | undefined>('readonly', (s) => s.get(id)))
}

export async function createBoard() {
  const { boards } = useBoard.getState()
  const id = crypto.randomUUID()
  await save()
  useBoard.setState({ boards: [...boards, { id, name: `Board ${boards.length + 1}` }] })
  show(id, undefined)
}

export function renameBoard(id: string, name: string) {
  const clean = name.trim().slice(0, 60)
  if (!clean) return
  useBoard.setState((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, name: clean } : b)) }))
}

export async function deleteBoard(id: string) {
  const { boards, boardId } = useBoard.getState()
  const rest = boards.filter((b) => b.id !== id)
  await run('readwrite', (s) => s.delete(id)).catch(() => {})
  if (!rest.length) {
    // never leave the app without a board
    const fresh = { id: crypto.randomUUID(), name: 'My board' }
    useBoard.setState({ boards: [fresh] })
    return show(fresh.id, undefined)
  }
  useBoard.setState({ boards: rest })
  if (id === boardId) show(rest[0].id, await run<Saved | undefined>('readonly', (s) => s.get(rest[0].id)))
}

/** Debounced save on every board change, plus an immediate save when the tab is hidden. */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined
  useBoard.subscribe((s, prev) => {
    const keys = ['elements', 'view', 'colorMeta', 'board', 'exportPrefs', 'boards', 'boardId'] as const
    if (keys.every((k) => s[k] === prev[k])) return
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
