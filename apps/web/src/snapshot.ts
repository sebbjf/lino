import type { ColorMeta } from './colors.ts'
import { fitView } from './geometry.ts'
import { CORNERS, DECOS, MIN_OPACITY, PATTERNS, type BoardStyle } from './style.ts'
import { KINDS } from './kinds/index.ts'
import { HEX, isNum, isStr, MAX_TEXT, oneOf } from './kinds/check.ts'
import type { Kind } from './kinds/types.ts'
import { externalize, IMAGE_ID, inline } from './images.ts'
import { useBoard, type BoardElement, type View } from './store.ts'

// The board snapshot: the portable content of a board (elements, palette edits, board style), shared by
// board files, shared boards and local saves. This is the only module that knows its shape.
export type Snapshot = { elements: BoardElement[]; colorMeta: Record<string, ColorMeta>; board: BoardStyle }

export { MAX_TEXT }
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,/

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** Same limits as the share API (`elementSchema` in apps/api/src/routes.ts; pinned by a test on each side). */
const MAX_POS = 1e6
const MAX_SIDE = 10_000

/** Known style fields only; anything else is dropped. */
function styleOf(e: Record<string, unknown>) {
  return {
    ...(oneOf(CORNERS, e.corner) && { corner: e.corner }),
    ...(typeof e.shadow === 'boolean' && { shadow: e.shadow }),
    ...(isNum(e.opacity) && { opacity: Math.min(1, Math.max(MIN_OPACITY, e.opacity)) }),
    ...(oneOf(DECOS, e.deco) && { deco: e.deco }),
    ...(e.locked === true && { locked: true }),
    ...(isStr(e.groupId, 64) && e.groupId && { groupId: e.groupId }),
  }
}

export function boardStyleOf(raw: unknown): BoardStyle {
  if (!raw || typeof raw !== 'object') return {}
  const b = raw as Record<string, unknown>
  return {
    ...(isStr(b.bg, 9) && HEX.test(b.bg) && { bg: b.bg }),
    ...(oneOf(PATTERNS, b.pattern) && { pattern: b.pattern }),
    ...(typeof b.messy === 'boolean' && { messy: b.messy }),
  }
}

/**
 * Rebuilds one element from untrusted JSON, keeping only known fields, or null if it is not usable.
 * Strict on URLs: a file may come from someone else, and links open on Enter.
 */
function toElement(raw: unknown, local: boolean): BoardElement | null {
  // ids point into this browser's image store: only its own records may carry them
  const isPicture = (v: unknown): v is string => isStr(v, Infinity) && (DATA_IMAGE.test(v) || (local && IMAGE_ID.test(v)))
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>
  if (!isNum(e.x) || !isNum(e.y) || !isNum(e.w) || !isNum(e.h) || e.w <= 0 || e.h <= 0) return null
  const box = {
    id: crypto.randomUUID(),
    x: clamp(e.x, -MAX_POS, MAX_POS),
    y: clamp(e.y, -MAX_POS, MAX_POS),
    w: clamp(e.w, 1, MAX_SIDE),
    h: clamp(e.h, 1, MAX_SIDE),
    rotation: isNum(e.rotation) ? e.rotation % 360 : 0,
    ...styleOf(e),
  }
  const kind = KINDS[e.type as BoardElement['type']] as Kind<BoardElement['type']> | undefined
  return kind?.parse(e, box, { isPicture }) ?? null
}

/** Parses a board file. Unusable elements are dropped and counted. */
export function parseBoardFile(text: string) {
  try {
    return parseBoard(JSON.parse(text))
  } catch {
    throw new Error('That file is not a Lino board.')
  }
}

/** Rebuilds a board from untrusted data: a file's JSON or a shared-board snapshot from the API. */
export function parseBoard(raw: unknown) {
  const data = raw as { elements?: unknown; colorMeta?: unknown; board?: unknown } | null
  if (!data || !Array.isArray(data.elements)) throw new Error('That is not a Lino board.')
  const elements = data.elements.map((e) => toElement(e, false)).filter((e) => e !== null)
  const colorMeta: Record<string, ColorMeta> = {}
  if (data.colorMeta && typeof data.colorMeta === 'object')
    for (const [hex, m] of Object.entries(data.colorMeta as Record<string, Record<string, unknown> | null>)) {
      if (!HEX.test(hex) || !m || typeof m !== 'object') continue
      colorMeta[hex.toLowerCase()] = {
        ...(isStr(m.name, 60) && { name: m.name }),
        ...(typeof m.pinned === 'boolean' && { pinned: m.pinned }),
        ...(typeof m.hidden === 'boolean' && { hidden: m.hidden }),
        ...(isNum(m.order) && { order: m.order }),
      }
    }
  return { elements, colorMeta, board: boardStyleOf(data.board), skipped: data.elements.length - elements.length }
}

/** Rebuilds a snapshot from untrusted data (a file, the share API, or this browser's own storage). Unusable elements are dropped and counted. */
export function parseSnapshot(raw: unknown, local = false): Snapshot & { skipped: number } {
  const data = raw as { elements?: unknown; colorMeta?: unknown; board?: unknown } | null
  if (!data || !Array.isArray(data.elements)) throw new Error('That is not a Lino board.')
  const elements = data.elements.map((e) => toElement(e, local)).filter((e) => e !== null)
  const colorMeta: Record<string, ColorMeta> = {}
  if (data.colorMeta && typeof data.colorMeta === 'object')
    for (const [hex, m] of Object.entries(data.colorMeta as Record<string, Record<string, unknown> | null>)) {
      if (!HEX.test(hex) || !m || typeof m !== 'object') continue
      colorMeta[hex.toLowerCase()] = {
        ...(isStr(m.name, 60) && { name: m.name }),
        ...(typeof m.pinned === 'boolean' && { pinned: m.pinned }),
        ...(typeof m.hidden === 'boolean' && { hidden: m.hidden }),
        ...(isNum(m.order) && { order: m.order }),
      }
    }
  return { elements, colorMeta, board: boardStyleOf(data.board), skipped: data.elements.length - elements.length }
}

/** Parses the text of a board file. */
export function parseSnapshotText(text: string) {
  try {
    return parseSnapshot(JSON.parse(text))
  } catch {
    throw new Error('That file is not a Lino board.')
  }
}

/** The board on screen with its pictures inline, for what leaves this browser (board file, share). */
export async function capturePortable() {
  const snap = captureSnapshot()
  const out = await inline(snap)
  const lost = snap.elements.length - out.elements.length
  if (lost) useBoard.getState().notify(`${lost} image${lost === 1 ? ' was' : 's were'} missing from this browser and left out.`)
  return out
}

/** The snapshot of the board on screen. */
export function captureSnapshot(): Snapshot {
  const { elements, colorMeta, board } = useBoard.getState()
  return { elements, colorMeta, board }
}

// Saving the board you are leaving is the local adapter's job; it registers itself here (storage.ts imports this module, not the reverse).
let leave: () => Promise<unknown> = async () => {}
export const onLeaveBoard = (fn: () => Promise<unknown>) => void (leave = fn)

/**
 * Puts a snapshot on screen. With no `view` it fits the content to the window.
 * - `replace`: into the current board, as one undo step.
 * - `new`: as another board (`id` given: that board, already in the index; none: a fresh one, after saving the current), with a clean history.
 * - `readonly`: the shared view, with a clean history.
 */
export async function openSnapshot(opened: Snapshot, mode: 'replace' | 'new' | 'readonly', opts: { view?: View; id?: string } = {}) {
  // a board you can edit keeps its pictures in the image store; if that is unavailable they stay inline and still show
  const snap = mode === 'readonly' ? opened : await externalize(opened).catch(() => opened)
  const { elements, colorMeta, board } = snap
  const view = opts.view ?? (elements.length ? fitView(elements, innerWidth, innerHeight) : { x: 0, y: 0, zoom: 1 })
  if (mode === 'replace') {
    useBoard.getState().replaceBoard(elements, colorMeta, board)
    return useBoard.getState().setView(view)
  }
  const clean = { elements, view, colorMeta, board, selectedIds: [], past: [], future: [], guides: [] }
  if (mode === 'readonly') return useBoard.setState({ ...clean, readOnly: true })
  let id = opts.id
  if (!id) {
    await leave()
    id = crypto.randomUUID()
    useBoard.setState((s) => ({ boards: [...s.boards, { id: id!, name: `Board ${s.boards.length + 1}` }] }))
  }
  useBoard.setState({ ...clean, boardId: id })
}
