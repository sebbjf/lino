import { create } from 'zustand'
import type { ColorMeta } from './colors.ts'
import type { Crop } from './crop.ts'
import { alignOffsets, distributeOffsets, layoutPositions, type AlignMode, type Box, type Guide, type Layout } from './geometry.ts'
import { ownStyleKeys, TYPED_KEYS } from './kinds/index.ts'
import { MESSY_TILT, type BoardStyle, type ElementStyle, type ImageStyle, type NoteStyle } from './style.ts'

/** `locked`: can't be moved, resized, rotated, edited or deleted until unlocked. */
type Base = Box & ElementStyle & { id: string; locked?: boolean }
export type BoardElement =
  | (Base & { type: 'image'; src: string; colors?: string[]; crop?: Crop } & ImageStyle)
  | (Base & { type: 'note'; text: string } & NoteStyle)
  | (Base & { type: 'color'; hex: string })
  | (Base & { type: 'link' } & LinkInfo)

/** How the palette is written out. `prefix` goes after `--` in CSS variables (Tailwind needs its own namespaces). */
export type StylePatch = ElementStyle & NoteStyle & ImageStyle
const STYLE_KEYS: (keyof StylePatch)[] = ['corner', 'shadow', 'opacity', 'deco', ...TYPED_KEYS]

/** Ids added in messy mode, so their view plays the drop-in once. */
export const justDropped = new Set<string>()

export type ExportPrefs = { prefix: string; format: 'hex' | 'oklch'; scales?: boolean }

export type LinkInfo = {
  url: string
  title: string | null
  image: string | null
  fonts: string[]
  colors: string[]
  status: 'loading' | 'ok' | 'error'
  /** What the page did not give us (title, image, fonts, colors). */
  missing: string[]
  error?: string
}

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewElement = DistOmit<BoardElement, 'id' | 'x' | 'y' | 'rotation'>

export type View = { x: number; y: number; zoom: number }
export type BoardMeta = { id: string; name: string }
export type Layer = 'forward' | 'backward' | 'front' | 'back'

type State = {
  /** Every local board (name and id) and the one on screen. The content lives in storage.ts. */
  boards: BoardMeta[]
  boardId: string
  elements: BoardElement[] // array order = z-order, last is on top
  /** Selected element ids; the last one is the most recently picked. */
  selectedIds: string[]
  view: View
  notice: string | null
  /** Alignment guides shown while dragging. */
  guides: Guide[]
  /** A shared board opened from a link: view only, nothing is saved. */
  readOnly: boolean
  /** The image being cropped (crop mode), if any. */
  cropId: string | null
  setCropId: (id: string | null) => void
  /** Palette edits keyed by normalized hex. */
  colorMeta: Record<string, ColorMeta>
  setColorMeta: (hex: string, patch: ColorMeta) => void
  restoreHiddenColors: () => void
  /** Canvas background and pattern. */
  board: BoardStyle
  setBoard: (patch: BoardStyle) => void
  exportPrefs: ExportPrefs
  setExportPrefs: (patch: Partial<ExportPrefs>) => void
  // undo history: whole snapshots (elements, palette edits, board style), cheap because unchanged parts are shared
  past: HistoryEntry[]
  future: HistoryEntry[]
  /**
   * Call once at the start of a continuous gesture (drag, typing) so it undoes as one step.
   * With a `key`, a checkpoint less than 600 ms after one with the same key adds no step (a held arrow key).
   */
  checkpoint: (key?: string) => void
  /** Runs several store operations as one undo step. Synchronous. */
  step: (fn: () => void) => void
  undo: () => void
  redo: () => void
  /** Adds an element centered on a world point (defaults to the viewport center) and returns its id. */
  add: (el: NewElement, at?: { x: number; y: number }) => string
  /** Does not push history (it runs many times per second in a drag): call checkpoint() first, or run inside step(). */
  update: (id: string, patch: Partial<BoardElement>) => void
  /** Adds a row of colour swatches under an element, as wide as it is, as one undo step. */
  swatchRow: (under: string, hexes: string[]) => void
  /** Applies a style patch to several elements. Does not push history: call checkpoint() first to make it undoable. */
  restyle: (ids: string[], patch: StylePatch) => void
  /** Style copied with copyStyle; unset fields are kept as undefined so pasting resets them. */
  copiedStyle: StylePatch | null
  copyStyle: (id: string) => void
  /** Pastes the copied style as one undo step; fields another type can't have are skipped. */
  pasteStyle: (ids: string[]) => void
  /** Moves several elements to new positions in one state change. Does not push history: call checkpoint() first. */
  moveMany: (pos: Record<string, { x: number; y: number }>) => void
  remove: (ids: string[]) => void
  duplicate: (ids: string[]) => void
  reorder: (id: string, to: Layer) => void
  /** Swaps in another board's elements as one undo step; palette edits are merged (they have no history). */
  replaceBoard: (elements: BoardElement[], colorMeta: Record<string, ColorMeta>, board?: BoardStyle) => void
  align: (ids: string[], mode: AlignMode) => void
  distribute: (ids: string[], axis: 'x' | 'y') => void
  /** Arranges elements into a layout template as one undo step (most templates reset rotation). */
  arrange: (ids: string[], mode: Layout) => void
  /** Selects one element (null clears); `toggle` adds or removes it from the current selection. */
  select: (id: string | null, toggle?: boolean) => void
  selectMany: (ids: string[]) => void
  setView: (view: View) => void
  notify: (msg: string | null) => void
}

export function viewportCenter(view: View) {
  return { x: (window.innerWidth / 2 - view.x) / view.zoom, y: (window.innerHeight / 2 - view.y) / view.zoom }
}

const HISTORY_LIMIT = 100
const COALESCE_MS = 600

export type HistoryEntry = { elements: BoardElement[]; colorMeta: Record<string, ColorMeta>; board: BoardStyle }
type Snap = Pick<State, 'elements' | 'colorMeta' | 'board'>
const entryOf = (s: Snap): HistoryEntry => ({ elements: s.elements, colorMeta: s.colorMeta, board: s.board })
const same = (a: HistoryEntry, s: Snap) => a.elements === s.elements && a.colorMeta === s.colorMeta && a.board === s.board
/** Whether Undo has anything to revert. */
export const hasUndo = (s: Snap & { past: HistoryEntry[] }) => s.past.some((p) => !same(p, s))

let batching = 0 // inside step(): its one entry is already pushed
let lastKey: { key: string; at: number; board: string } | null = null

// Snapshot the current state unless it is already the latest entry (e.g. a click that never moved), or this is part of a step or a burst.
function pushHistory(s: State, key?: string) {
  if (batching) return {}
  const now = Date.now()
  const burst = !!key && lastKey?.key === key && lastKey.board === s.boardId && now - lastKey.at < COALESCE_MS // a burst never spans two boards
  lastKey = key ? { key, at: now, board: s.boardId } : null
  if (burst) return { future: [] as HistoryEntry[] }
  const last = s.past.at(-1)
  return last && same(last, s) ? { future: [] as HistoryEntry[] } : { past: [...s.past, entryOf(s)].slice(-HISTORY_LIMIT), future: [] as HistoryEntry[] }
}

function keepSelection(elements: BoardElement[], ids: string[]) {
  return ids.filter((id) => elements.some((e) => e.id === id))
}

/** Applies per-element offsets as one undo step. */
function shift(s: State, ids: string[], offsets: (els: BoardElement[]) => { dx: number; dy: number }[]) {
  const els = s.elements.filter((e) => ids.includes(e.id) && !e.locked)
  if (els.length < 2) return s
  const by = new Map(offsets(els).map((o, i) => [els[i].id, o]))
  return {
    ...pushHistory(s),
    elements: s.elements.map((e) => {
      const o = by.get(e.id)
      return o && (o.dx || o.dy) ? { ...e, x: e.x + o.dx, y: e.y + o.dy } : e
    }),
  }
}

export const useBoard = create<State>()((set, get) => ({
  boards: [{ id: 'local', name: 'My board' }],
  boardId: 'local',
  elements: [],
  selectedIds: [],
  view: { x: 0, y: 0, zoom: 1 },
  notice: null,
  readOnly: false,
  cropId: null,
  setCropId: (cropId) => set({ cropId }),
  guides: [],
  colorMeta: {},
  board: {},
  copiedStyle: null,
  exportPrefs: { prefix: '', format: 'hex' },
  past: [],
  future: [],

  checkpoint: (key) => set((s) => pushHistory(s, typeof key === 'string' ? key : undefined)),

  step: (fn) => {
    set((s) => pushHistory(s))
    batching++
    try {
      fn()
    } finally {
      batching--
    }
  },

  undo: () =>
    set((s) => {
      lastKey = null
      const past = [...s.past]
      while (past.length && same(past.at(-1)!, s)) past.pop()
      const prev = past.pop()
      if (!prev) return { past }
      return { ...prev, past, future: [entryOf(s), ...s.future], selectedIds: keepSelection(prev.elements, s.selectedIds) }
    }),

  redo: () =>
    set((s) => {
      lastKey = null
      const [next, ...future] = s.future
      if (!next) return s
      return { ...next, future, past: [...s.past, entryOf(s)], selectedIds: keepSelection(next.elements, s.selectedIds) }
    }),

  add: (el, at) => {
    const id = crypto.randomUUID()
    // messy mode: a small random tilt, like something dropped on a table
    const messy = get().board.messy
    const rotation = messy ? Math.round((Math.random() * 2 - 1) * MESSY_TILT * 10) / 10 : 0
    if (messy) justDropped.add(id)
    const c = at ?? viewportCenter(get().view)
    let x = c.x - el.w / 2
    let y = c.y - el.h / 2
    // added from the toolbar twice in a row: step aside so the new one does not hide the last
    if (!at) while (get().elements.some((e) => e.x === x && e.y === y)) (x += 24), (y += 24)
    const full = { ...el, id, x, y, rotation } as BoardElement
    set((s) => ({ ...pushHistory(s), elements: [...s.elements, full], selectedIds: [id] }))
    return id
  },

  swatchRow: (under, hexes) =>
    set((s) => {
      const el = s.elements.find((e) => e.id === under)
      if (!el || !hexes.length) return s
      const gap = 8
      const side = (el.w - gap * (hexes.length - 1)) / hexes.length
      const row = hexes.map((hex, i): BoardElement => ({ id: crypto.randomUUID(), type: 'color', hex, x: el.x + i * (side + gap), y: el.y + el.h + gap, w: side, h: side, rotation: 0 }))
      return { ...pushHistory(s), elements: [...s.elements, ...row], selectedIds: row.map((e) => e.id) }
    }),

  update: (id, patch) =>
    set((s) => ({ elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)) })),

  restyle: (ids, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => {
        if (!ids.includes(e.id) || e.locked) return e
        // type-specific fields (note color, image filter...) never land on other element types
        const own = ownStyleKeys(e.type)
        const keep = Object.fromEntries(Object.entries(patch).filter(([k]) => !TYPED_KEYS.includes(k as keyof StylePatch) || own.includes(k as keyof StylePatch)))
        return { ...e, ...keep } as BoardElement
      }),
    })),

  copyStyle: (id) => {
    const el = get().elements.find((e) => e.id === id) as (BoardElement & StylePatch) | undefined
    if (el) set({ copiedStyle: Object.fromEntries(STYLE_KEYS.map((k) => [k, el[k]])) as StylePatch, notice: 'Style copied.' })
  },

  pasteStyle: (ids) => {
    const { copiedStyle, checkpoint, restyle } = get()
    if (!copiedStyle || !ids.length) return
    checkpoint()
    restyle(ids, copiedStyle)
  },

  moveMany: (pos) => set((s) => ({ elements: s.elements.map((e) => (pos[e.id] ? { ...e, ...pos[e.id] } : e)) })),

  remove: (ids) =>
    set((s) => ({
      ...pushHistory(s),
      elements: s.elements.filter((e) => !ids.includes(e.id)),
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
    })),

  duplicate: (ids) => {
    const copies = get()
      .elements.filter((e) => ids.includes(e.id))
      .map((src) => ({ ...src, id: crypto.randomUUID(), x: src.x + 24, y: src.y + 24 }))
    if (!copies.length) return
    set((s) => ({ ...pushHistory(s), elements: [...s.elements, ...copies], selectedIds: copies.map((c) => c.id) }))
  },

  replaceBoard: (elements, colorMeta, board) =>
    set((s) => ({ ...pushHistory(s), elements, selectedIds: [], colorMeta: { ...s.colorMeta, ...colorMeta }, ...(board && { board }) })),

  align: (ids, mode) => set((s) => shift(s, ids, (els) => alignOffsets(els, mode))),
  distribute: (ids, axis) => set((s) => shift(s, ids, (els) => (els.length < 3 ? els.map(() => ({ dx: 0, dy: 0 })) : distributeOffsets(els, axis)))),

  arrange: (ids, mode) =>
    set((s) => {
      const els = s.elements.filter((e) => ids.includes(e.id) && !e.locked)
      if (els.length < 2) return s
      const pos = new Map(layoutPositions(els, mode).map((p, i) => [els[i].id, p]))
      let elements = s.elements.map((e) => (pos.has(e.id) ? { ...e, ...pos.get(e.id)! } : e))
      if (mode === 'fan') {
        // stack the hand left to right, each card over the previous one, in the layers these elements already had
        const hand = elements.filter((e) => pos.has(e.id)).sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2))
        let k = 0
        elements = elements.map((e) => (pos.has(e.id) ? hand[k++] : e))
      }
      return { ...pushHistory(s), elements }
    }),

  reorder: (id, to) =>
    set((s) => {
      const i = s.elements.findIndex((e) => e.id === id)
      if (i < 0) return s
      const els = [...s.elements]
      const [el] = els.splice(i, 1)
      const j = { forward: Math.min(i + 1, els.length), backward: Math.max(i - 1, 0), front: els.length, back: 0 }[to]
      if (i === j) return s
      els.splice(j, 0, el)
      return { ...pushHistory(s), elements: els }
    }),

  select: (id, toggle) =>
    set((s) => {
      if (!id) return { selectedIds: [] }
      if (!toggle) return { selectedIds: [id] }
      return { selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id] }
    }),
  selectMany: (selectedIds) => set({ selectedIds }),
  setView: (view) => set({ view }),
  notify: (notice) => set({ notice }),

  // typing a name makes one step per burst; the other palette edits are single clicks
  setColorMeta: (hex, patch) => set((s) => ({ ...pushHistory(s, 'name' in patch ? `name:${hex}` : undefined), colorMeta: { ...s.colorMeta, [hex]: { ...s.colorMeta[hex], ...patch } } })),

  // a color picker scrubbed within 600 ms is one step; changing a different field is another
  setBoard: (patch) => set((s) => ({ ...pushHistory(s, `board:${Object.keys(patch).sort().join()}`), board: { ...s.board, ...patch } })),
  setExportPrefs: (patch) => set((s) => ({ exportPrefs: { ...s.exportPrefs, ...patch } })),

  restoreHiddenColors: () =>
    set((s) => ({
      ...pushHistory(s),
      colorMeta: Object.fromEntries(Object.entries(s.colorMeta).map(([hex, m]) => [hex, { ...m, hidden: false }])),
    })),
}))
