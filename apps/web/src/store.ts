import { create } from 'zustand'
import type { ColorMeta } from './colors.ts'
import { alignOffsets, distributeOffsets, layoutPositions, type AlignMode, type Box, type Guide, type Layout } from './geometry.ts'
import { MESSY_TILT, type BoardStyle, type ElementStyle, type ImageStyle, type NoteStyle } from './style.ts'

type Base = Box & ElementStyle & { id: string }
export type BoardElement =
  | (Base & { type: 'image'; src: string } & ImageStyle)
  | (Base & { type: 'note'; text: string } & NoteStyle)
  | (Base & { type: 'color'; hex: string })
  | (Base & { type: 'link' } & LinkInfo)

/** How the palette is written out. `prefix` goes after `--` in CSS variables (Tailwind needs its own namespaces). */
export type StylePatch = ElementStyle & NoteStyle & ImageStyle
/** Style fields that belong to one element type only. */
const OWN: Partial<Record<BoardElement['type'], (keyof StylePatch)[]>> = { note: ['bg', 'color', 'size', 'font', 'family', 'align', 'bold', 'italic'], image: ['filter', 'duo'] }
const TYPED = Object.values(OWN).flat()
const STYLE_KEYS: (keyof StylePatch)[] = ['corner', 'shadow', 'opacity', 'deco', ...TYPED]

/** Ids added in messy mode, so their view plays the drop-in once. */
export const justDropped = new Set<string>()

export type ExportPrefs = { prefix: string; format: 'hex' | 'oklch' }

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
  /** Palette edits keyed by normalized hex. Not part of undo history. */
  colorMeta: Record<string, ColorMeta>
  setColorMeta: (hex: string, patch: ColorMeta) => void
  restoreHiddenColors: () => void
  /** Canvas background and pattern. Not part of undo history. */
  board: BoardStyle
  setBoard: (patch: BoardStyle) => void
  exportPrefs: ExportPrefs
  setExportPrefs: (patch: Partial<ExportPrefs>) => void
  // undo history: whole elements arrays, cheap because updates share unchanged objects
  past: BoardElement[][]
  future: BoardElement[][]
  /** Call once at the start of a continuous gesture (drag, typing) so it undoes as one step. */
  checkpoint: () => void
  undo: () => void
  redo: () => void
  /** Adds an element centered on a world point (defaults to the viewport center) and returns its id. */
  add: (el: NewElement, at?: { x: number; y: number }) => string
  update: (id: string, patch: Partial<BoardElement>) => void
  /** Applies a style patch to several elements. Call checkpoint() first to make it undoable. */
  restyle: (ids: string[], patch: StylePatch) => void
  /** Style copied with copyStyle; unset fields are kept as undefined so pasting resets them. */
  copiedStyle: StylePatch | null
  copyStyle: (id: string) => void
  /** Pastes the copied style as one undo step; fields another type can't have are skipped. */
  pasteStyle: (ids: string[]) => void
  /** Moves several elements to new positions in one state change. */
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

// Snapshot the current elements unless they are already the latest snapshot (e.g. a click that never moved).
function pushHistory(s: State) {
  return s.past.at(-1) === s.elements ? { future: [] } : { past: [...s.past, s.elements].slice(-HISTORY_LIMIT), future: [] }
}

function keepSelection(elements: BoardElement[], ids: string[]) {
  return ids.filter((id) => elements.some((e) => e.id === id))
}

/** Applies per-element offsets as one undo step. */
function shift(s: State, ids: string[], offsets: (els: BoardElement[]) => { dx: number; dy: number }[]) {
  const els = s.elements.filter((e) => ids.includes(e.id))
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
  guides: [],
  colorMeta: {},
  board: {},
  copiedStyle: null,
  exportPrefs: { prefix: '', format: 'hex' },
  past: [],
  future: [],

  checkpoint: () => set(pushHistory),

  undo: () =>
    set((s) => {
      const past = [...s.past]
      while (past.at(-1) === s.elements) past.pop()
      const prev = past.pop()
      if (!prev) return { past }
      return { elements: prev, past, future: [s.elements, ...s.future], selectedIds: keepSelection(prev, s.selectedIds) }
    }),

  redo: () =>
    set((s) => {
      const [next, ...future] = s.future
      if (!next) return s
      return { elements: next, future, past: [...s.past, s.elements], selectedIds: keepSelection(next, s.selectedIds) }
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

  update: (id, patch) =>
    set((s) => ({ elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)) })),

  restyle: (ids, patch) =>
    set((s) => ({
      elements: s.elements.map((e) => {
        if (!ids.includes(e.id)) return e
        // type-specific fields (note color, image filter...) never land on other element types
        const own = OWN[e.type] ?? []
        const keep = Object.fromEntries(Object.entries(patch).filter(([k]) => !TYPED.includes(k as keyof StylePatch) || own.includes(k as keyof StylePatch)))
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
      const els = s.elements.filter((e) => ids.includes(e.id))
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

  setColorMeta: (hex, patch) => set((s) => ({ colorMeta: { ...s.colorMeta, [hex]: { ...s.colorMeta[hex], ...patch } } })),

  setBoard: (patch) => set((s) => ({ board: { ...s.board, ...patch } })),
  setExportPrefs: (patch) => set((s) => ({ exportPrefs: { ...s.exportPrefs, ...patch } })),

  restoreHiddenColors: () =>
    set((s) => ({
      colorMeta: Object.fromEntries(Object.entries(s.colorMeta).map(([hex, m]) => [hex, { ...m, hidden: false }])),
    })),
}))
