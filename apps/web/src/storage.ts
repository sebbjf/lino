import { run as idb } from './db.ts'
import { backfillColors } from './image.ts'
import { externalize, IMAGE_ID, sweepImages } from './images.ts'
import { useSettings } from './settings.ts'
import { captureSnapshot, onLeaveBoard, openSnapshot, parseSnapshot, type Snapshot } from './snapshot.ts'
import { useBoard, type BoardMeta, type ExportPrefs, type View } from './store.ts'

// Many local boards: each is stored under its own id ('local' is the original single board), plus an index of names.
const INDEX = 'index'
type Index = { current: string; boards: BoardMeta[] }
// What is stored under a board id: the snapshot plus this device's export preferences. Older records also carry the view.
type Saved = Partial<Snapshot> & { elements: unknown[]; view?: View; exportPrefs?: ExportPrefs }
const EMPTY: Snapshot = { elements: [], colorMeta: {}, board: {} }
const DEFAULT_VIEW: View = { x: 0, y: 0, zoom: 1 }
const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => idb('boards', mode, fn)
const read = <T,>(key: string) => run<T | undefined>('readonly', (s) => s.get(key))

// What is saved, and when. Keys in the 'boards' store: INDEX (names + current board), `<id>` (snapshot + export prefs), `<id>:view` (pan and zoom).
// - on every board change, debounced (and when the tab is hidden): `save` writes all three; a pan or zoom alone writes only the view
// - when switching away from a board, or creating one: `save` first
// - on opening a board: its images move to the image store once, and the record is rewritten without inline pictures

// ---- Reading ----

const readIndex = () => read<Index>(INDEX)

/**
 * A board record with its view. The view lives in its own record so panning does not rewrite every image; boards saved before
 * that carry it inside the board record, and it is copied to its own record the first time they are read.
 */
async function readBoard(id: string) {
  const saved = await read<Saved>(id)
  let view = await read<View>(`${id}:view`)
  if (!view && saved?.view) {
    view = saved.view
    await run('readwrite', (s) => s.put(view, `${id}:view`)).catch(() => {})
  }
  return { saved, view }
}

/** A phone opens a board made on a desktop zoomed to fit, instead of cropped to its top-left. */
const fitsOnPhone = (view: View, count: number) => innerWidth < 700 && count > 0 && view.x === 0 && view.y === 0 && view.zoom === 1

/** Puts a saved board on screen through the snapshot parse (a clean slate for undo and selection). */
async function show(id: string, saved: Saved | undefined, savedView?: View) {
  let snap: Snapshot = parseSnapshot(saved ?? EMPTY, true)
  // a board saved with its images inline moves them to the image store the first time it is opened (blobs first, then the record, so a crash keeps the old record whole)
  const moved = await externalize(snap).catch(() => snap)
  if (saved && moved !== snap) {
    snap = moved
    await run('readwrite', (s) => s.put({ ...saved, elements: snap.elements }, id)).catch(() => {})
  }
  const view = savedView ?? DEFAULT_VIEW
  await openSnapshot(snap, 'new', { id, view: fitsOnPhone(view, snap.elements.length) ? undefined : view })
  if (saved?.exportPrefs) useBoard.setState({ exportPrefs: saved.exportPrefs })
  void backfillColors()
}

// ---- Saving ----

const saveView = () => {
  const { view, boardId } = useBoard.getState()
  return run('readwrite', (s) => s.put(view, `${boardId}:view`)).catch(() => useBoard.getState().notify('Could not save the board in this browser.'))
}

async function showStored(id: string) {
  const { saved, view } = await readBoard(id)
  return show(id, saved, view)
}

export async function loadBoard() {
  const index = await readIndex()
  if (index?.boards.length) {
    const current = index.boards.find((b) => b.id === index.current) ?? index.boards[0]
    useBoard.setState({ boards: index.boards })
    await showStored(current.id)
  } else {
    // first run, or a board saved before there were several
    await showStored('local')
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
  await showStored(id)
}

// A hook, not a direct call from snapshot.ts: that would make snapshot.ts and this module import each other.
onLeaveBoard(save)

/** A new board starts with the pattern and messy mode chosen in Settings. */
export const createBoard = () => {
  const { newPattern, newMessy } = useSettings.getState()
  return openSnapshot({ ...EMPTY, board: { ...(newPattern !== 'dots' && { pattern: newPattern }), ...(newMessy && { messy: true }) } }, 'new')
}

/** Saves a snapshot as a new local board and makes it the current one. Used from the read-only view. */
export async function saveAsLocalBoard(snap: Snapshot, name: string) {
  const index = (await readIndex()) ?? { current: 'local', boards: [{ id: 'local', name: 'My board' }] }
  const id = crypto.randomUUID()
  const external = await externalize(snap)
  await run('readwrite', (s) => s.put({ ...external } satisfies Saved, id))
  await run('readwrite', (s) => s.put({ current: id, boards: [...index.boards, { id, name }] } satisfies Index, INDEX))
}

/** Only changes the `boards` list in memory: the autosave subscription sees it change and `save` writes the index. */
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
  if (id === boardId) await showStored(rest[0].id)
}

// ---- Image sweep ----

/**
 * Deletes stored images that no saved board uses. Once per start, after the first board is open: undo history
 * is empty then, and no migration is half done. Gives up if any record cannot be read.
 */
export async function sweepStoredImages() {
  // another open tab may hold images no saved record mentions yet: sweep only when this is the only tab (each tab holds the lock shared for its lifetime)
  const locks = navigator.locks
  if (!locks) return sweepNow()
  await locks.request('lino-sweep', { mode: 'exclusive', ifAvailable: true }, (lock) => (lock ? sweepNow() : undefined))
  void locks.request('lino-sweep', { mode: 'shared' }, () => new Promise(() => {}))
}

async function sweepNow() {
  const used = new Set<string>()
  const scan = (els: unknown) => {
    if (Array.isArray(els)) for (const e of els as { src?: unknown; image?: unknown }[]) for (const v of [e?.src, e?.image]) if (typeof v === 'string' && IMAGE_ID.test(v)) used.add(v)
  }
  for (const rec of await run<unknown[]>('readonly', (s) => s.getAll())) scan((rec as Partial<Saved> | undefined)?.elements)
  scan(useBoard.getState().elements) // the open board, in case its record could not be rewritten
  await sweepImages(used)
}

// ---- Autosave ----

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
