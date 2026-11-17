import { captureSnapshot, onLeaveBoard, openSnapshot, parseSnapshot, type Snapshot } from './snapshot.ts'
import { useBoard, type BoardMeta, type ExportPrefs, type View } from './store.ts'

// Many local boards: each is stored under its own id ('local' is the original single board), plus an index of names.
const INDEX = 'index'
type Index = { current: string; boards: BoardMeta[] }
// What is stored under a board id: the snapshot plus this device's export preferences. Older records also carry the view.
type Saved = Partial<Snapshot> & { elements: unknown[]; view?: View; exportPrefs?: ExportPrefs }
const EMPTY: Snapshot = { elements: [], colorMeta: {}, board: {} }
const DEFAULT_VIEW: View = { x: 0, y: 0, zoom: 1 }
const readIndex = async () => (await run<Index | undefined>('readonly', (s) => s.get(INDEX))) ?? undefined

let dbPromise: Promise<IDBDatabase> | undefined
function db() {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open('lino', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('boards')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => {
      dbPromise = undefined // let the next call try again
      reject(req.error)
    }
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction('boards', mode)
  return new Promise((resolve, reject) => {
    const req = fn(tx.objectStore('boards'))
    // a write only counts once the transaction commits: a full disk aborts it after the request succeeded
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = tx.onabort = () => reject(tx.error ?? req.error)
  })
}

/** Puts a saved board on screen through the snapshot parse (a clean slate for undo and selection). */
async function show(id: string, saved: Saved | undefined, savedView?: View) {
  const snap = parseSnapshot(saved ?? EMPTY)
  const view = savedView ?? saved?.view ?? DEFAULT_VIEW
  // a phone opens a board made on a desktop zoomed to fit, instead of cropped to its top-left
  const untouched = view.x === 0 && view.y === 0 && view.zoom === 1
  await openSnapshot(snap, 'new', { id, view: innerWidth < 700 && snap.elements.length && untouched ? undefined : view })
  if (saved?.exportPrefs) useBoard.setState({ exportPrefs: saved.exportPrefs })
}

// The view has its own small record, so panning does not rewrite every image. Older boards still carry it inside the board record.
const readView = (id: string) => run<View | undefined>('readonly', (s) => s.get(`${id}:view`))
const saveView = () => {
  const { view, boardId } = useBoard.getState()
  return run('readwrite', (s) => s.put(view, `${boardId}:view`)).catch(() => useBoard.getState().notify('Could not save the board in this browser.'))
}

export async function loadBoard() {
  const index = await readIndex()
  if (index?.boards.length) {
    const current = index.boards.find((b) => b.id === index.current) ?? index.boards[0]
    useBoard.setState({ boards: index.boards })
    await show(current.id, await run<Saved | undefined>('readonly', (s) => s.get(current.id)), await readView(current.id))
  } else {
    // first run, or a board saved before there were several
    await show('local', await run<Saved | undefined>('readonly', (s) => s.get('local')), await readView('local'))
  }
}

function save() {
  const { exportPrefs, boards, boardId } = useBoard.getState()
  return Promise.all([
    saveView(),
    run('readwrite', (s) => s.put({ ...captureSnapshot(), exportPrefs } satisfies Saved, boardId)),
    run('readwrite', (s) => s.put({ current: boardId, boards } satisfies Index, INDEX)),
  ]).catch(() => useBoard.getState().notify('Could not save the board in this browser.'))
}

/** Saves the board on screen now, then shows another one. */
export async function switchBoard(id: string) {
  if (id === useBoard.getState().boardId) return
  await save()
  await show(id, await run<Saved | undefined>('readonly', (s) => s.get(id)), await readView(id))
}

onLeaveBoard(save)

export const createBoard = () => openSnapshot(EMPTY, 'new')

/** Saves a snapshot as a new local board and makes it the current one. Used from the read-only view. */
export async function saveAsLocalBoard(snap: Snapshot, name: string) {
  const index = (await readIndex()) ?? { current: 'local', boards: [{ id: 'local', name: 'My board' }] }
  const id = crypto.randomUUID()
  await run('readwrite', (s) => s.put({ ...snap } satisfies Saved, id))
  await run('readwrite', (s) => s.put({ current: id, boards: [...index.boards, { id, name }] } satisfies Index, INDEX))
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
  await run('readwrite', (s) => s.delete(`${id}:view`)).catch(() => {})
  if (!rest.length) {
    // never leave the app without a board
    const fresh = { id: crypto.randomUUID(), name: 'My board' }
    useBoard.setState({ boards: [fresh] })
    return await show(fresh.id, undefined)
  }
  useBoard.setState({ boards: rest })
  if (id === boardId) await show(rest[0].id, await run<Saved | undefined>('readonly', (s) => s.get(rest[0].id)), await readView(rest[0].id))
}

/** Debounced save on every board change, plus an immediate save when the tab is hidden. */
export function startAutosave() {
  let timer: ReturnType<typeof setTimeout> | undefined
  let full = false // something besides the view changed since the last save
  const flush = () => {
    const all = full
    full = false
    return all ? save() : saveView()
  }
  useBoard.subscribe((s, prev) => {
    const keys = ['elements', 'view', 'colorMeta', 'board', 'exportPrefs', 'boards', 'boardId'] as const
    if (keys.every((k) => s[k] === prev[k])) return
    // a pan or zoom alone only rewrites the small view record
    full ||= keys.some((k) => k !== 'view' && s[k] !== prev[k])
    clearTimeout(timer)
    timer = setTimeout(flush, 300)
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer)
      flush()
    }
  })
}
