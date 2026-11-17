import { useBoard, type Layer } from './store.ts'

// Commands on the selection, shared by the keyboard and the toolbar. The read-only check lives here, once:
// the store actions stay ungated because opening a shared board, undo and drags use them too.
// Each command is one undo step; a burst of nudges or rotations of the same elements (a held key) is one.

const board = () => useBoard.getState()
/** The ids a command may act on: none on a read-only board. */
const editable = (ids: string[]) => (board().readOnly ? [] : ids)

/** What a command aimed at `focusedId` acts on: the selection if that element is in it (or nothing is focused), else just that element. */
export function targetOf(focusedId?: string) {
  const { selectedIds } = board()
  return focusedId && !selectedIds.includes(focusedId) ? [focusedId] : selectedIds
}

export function nudge(ids: string[], dx: number, dy: number) {
  const target = editable(ids)
  if (!target.length) return
  board().checkpoint(`nudge:${target.join()}`)
  board().moveMany(Object.fromEntries(board().elements.filter((e) => target.includes(e.id)).map((e) => [e.id, { x: e.x + dx, y: e.y + dy }])))
}

/** Turns each element 15° (clockwise for 1, counter-clockwise for -1) about its own centre, within -180..180. */
export function rotateStep(ids: string[], dir: 1 | -1) {
  const target = editable(ids)
  if (!target.length) return
  board().checkpoint(`rotate:${target.join()}`)
  for (const e of board().elements.filter((e) => target.includes(e.id))) {
    const deg = Math.round((e.rotation + dir * 15) / 15) * 15
    board().update(e.id, { rotation: ((((deg + 180) % 360) + 360) % 360) - 180 })
  }
}

export function remove(ids: string[]) {
  const target = editable(ids)
  if (target.length) board().remove(target)
}

export function duplicate(ids: string[]) {
  const target = editable(ids)
  if (target.length) board().duplicate(target)
}

/** One element only: moving several through the layers would have to decide what happens to their relative order. */
export function reorder(id: string, to: Layer) {
  if (editable([id]).length) board().reorder(id, to)
}
