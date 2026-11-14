import { create } from 'zustand'
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

export const useBoard = create<State>()((set, get) => ({
  elements: [],
  selectedId: null,
  view: { x: 0, y: 0, zoom: 1 },
  notice: null,

  add: (el, at = viewportCenter(get().view)) => {
    const id = crypto.randomUUID()
    const full = { ...el, id, x: at.x - el.w / 2, y: at.y - el.h / 2, rotation: 0 } as BoardElement
    set((s) => ({ elements: [...s.elements, full], selectedId: id }))
  },

  update: (id, patch) =>
    set((s) => ({ elements: s.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as BoardElement) : e)) })),

  remove: (id) =>
    set((s) => ({ elements: s.elements.filter((e) => e.id !== id), selectedId: s.selectedId === id ? null : s.selectedId })),

  duplicate: (id) => {
    const src = get().elements.find((e) => e.id === id)
    if (!src) return
    const copy = { ...src, id: crypto.randomUUID(), x: src.x + 24, y: src.y + 24 }
    set((s) => ({ elements: [...s.elements, copy], selectedId: copy.id }))
  },

  reorder: (id, to) =>
    set((s) => {
      const i = s.elements.findIndex((e) => e.id === id)
      if (i < 0) return s
      const els = [...s.elements]
      const [el] = els.splice(i, 1)
      const j = { forward: Math.min(i + 1, els.length), backward: Math.max(i - 1, 0), front: els.length, back: 0 }[to]
      els.splice(j, 0, el)
      return { elements: els }
    }),

  select: (selectedId) => set({ selectedId }),
  setView: (view) => set({ view }),
  notify: (notice) => set({ notice }),
}))
