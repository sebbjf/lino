import { create } from 'zustand'
import type { ColorMeta } from './colors.ts'
import type { Box } from './geometry.ts'

export type BoardElement =
  | (Box & { id: string; type: 'image'; src: string })
  | (Box & { id: string; type: 'note'; text: string })
  | (Box & { id: string; type: 'color'; hex: string })

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewElement = DistOmit<BoardElement, 'id' | 'x' | 'y' | 'rotation'>

export type View = { x: number; y: number; zoom: number }
export type Layer = 'forward' | 'backward' | 'front' | 'back'

type State = {
  elements: BoardElement[] // array order = z-order, last is on top
  selectedId: string | null
  view: View
  notice: string | null
  /** Palette edits keyed by normalized hex. Not part of undo history. */
  colorMeta: Record<string, ColorMeta>
  setColorMeta: (hex: string, patch: ColorMeta) => void
  restoreHiddenColors: () => void
  // undo history: whole elements arrays, cheap because updates share unchanged objects
  past: BoardElement[][]
  future: BoardElement[][]
  /** Call once at the start of a continuous gesture (drag, typing) so it undoes as one step. */
  checkpoint: () => void
  undo: () => void
  redo: () => void
  /** Adds an element centered on a world point (defaults to the viewport center). */
  add: (el: NewElement, at?: { x: number; y: number }) => void
  update: (id: string, patch: Partial<BoardElement>) => void
  remove: (id: string) => void
  duplicate: (id: string) => void
  reorder: (id: string, to: Layer) => void
  select: (id: string | null) => void
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

function keepSelection(elements: BoardElement[], id: string | null) {
  return id && elements.some((e) => e.id === id) ? id : null
}

export const useBoard = create<State>()((set, get) => ({
  elements: [],
  selectedId: null,
  view: { x: 0, y: 0, zoom: 1 },
  notice: null,
  colorMeta: {},
  past: [],
  future: [],

  checkpoint: () => set(pushHistory),

  undo: () =>
    set((s) => {
      const past = [...s.past]
      while (past.at(-1) === s.elements) past.pop()
      const prev = past.pop()
      if (!prev) return { past }
      return { elements: prev, past, future: [s.elements, ...s.future], selectedId: keepSelection(prev, s.selectedId) }
    }),

  redo: () =>
    set((s) => {
      const [next, ...future] = s.future
      if (!next) return s
      return { elements: next, future, past: [...s.past, s.elements], selectedId: keepSelection(next, s.selectedId) }
    }),

  add: (el, at = viewportCenter(get().view)) => {
    const id = crypto.randomUUID()
    const full = { ...el, id, x: at.x - el.w / 2, y: at.y - el.h / 2, rotation: 0 } as BoardElement
    set((s) => ({ ...pushHistory(s), elements: [...s.elements, full], selectedId: id }))
  },

  update: (id, patch) =>
    set((s) => ({ elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)) })),

  remove: (id) =>
    set((s) => ({
      ...pushHistory(s),
      elements: s.elements.filter((e) => e.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),

  duplicate: (id) => {
    const src = get().elements.find((e) => e.id === id)
    if (!src) return
    const copy = { ...src, id: crypto.randomUUID(), x: src.x + 24, y: src.y + 24 }
    set((s) => ({ ...pushHistory(s), elements: [...s.elements, copy], selectedId: copy.id }))
  },

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

  select: (selectedId) => set({ selectedId }),
  setView: (view) => set({ view }),
  notify: (notice) => set({ notice }),

  setColorMeta: (hex, patch) => set((s) => ({ colorMeta: { ...s.colorMeta, [hex]: { ...s.colorMeta[hex], ...patch } } })),

  restoreHiddenColors: () =>
    set((s) => ({
      colorMeta: Object.fromEntries(Object.entries(s.colorMeta).map(([hex, m]) => [hex, { ...m, hidden: false }])),
    })),
}))
