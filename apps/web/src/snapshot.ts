import type { ColorMeta } from './colors.ts'
import { fitView } from './geometry.ts'
import { CORNERS, DECOS, FAMILY, IMAGE_FILTERS, MIN_OPACITY, NOTE_ALIGNS, NOTE_FONTS, NOTE_SIZES, PATTERNS, type BoardStyle } from './style.ts'
import { useBoard, type BoardElement, type View } from './store.ts'

// The board snapshot: the portable content of a board (elements, palette edits, board style), shared by
// board files, shared boards and local saves. This is the only module that knows its shape.
export type Snapshot = { elements: BoardElement[]; colorMeta: Record<string, ColorMeta>; board: BoardStyle }

export const MAX_TEXT = 10_000
const HEX = /^#[0-9a-f]{3,8}$/i
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,/

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown, max = MAX_TEXT): v is string => typeof v === 'string' && v.length <= max
const strList = (v: unknown, ok: (s: string) => boolean = () => true) =>
  Array.isArray(v) ? v.filter((s): s is string => isStr(s, 200) && ok(s)).slice(0, 20) : []
const isHttp = (v: unknown): v is string => {
  try {
    return isStr(v, 2048) && /^https?:$/.test(new URL(v).protocol)
  } catch {
    return false
  }
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
/** Same limits as the share API (`elementSchema` in apps/api/src/routes.ts; pinned by a test on each side). */
const MAX_POS = 1e6
const MAX_SIDE = 10_000

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => list.includes(v as T)

/** Known style fields only; anything else is dropped. */
function styleOf(e: Record<string, unknown>) {
  return {
    ...(oneOf(CORNERS, e.corner) && { corner: e.corner }),
    ...(typeof e.shadow === 'boolean' && { shadow: e.shadow }),
    ...(isNum(e.opacity) && { opacity: Math.min(1, Math.max(MIN_OPACITY, e.opacity)) }),
    ...(oneOf(DECOS, e.deco) && { deco: e.deco }),
  }
}

function noteStyleOf(e: Record<string, unknown>) {
  return {
    ...(isStr(e.bg, 9) && HEX.test(e.bg) && { bg: e.bg }),
    ...(isStr(e.color, 9) && HEX.test(e.color) && { color: e.color }),
    ...(oneOf(NOTE_SIZES, e.size) && { size: e.size }),
    ...(oneOf(NOTE_ALIGNS, e.align) && { align: e.align }),
    ...(typeof e.bold === 'boolean' && { bold: e.bold }),
    ...(typeof e.italic === 'boolean' && { italic: e.italic }),
    ...(oneOf(NOTE_FONTS, e.font) && { font: e.font }),
    ...(isStr(e.family, 60) && FAMILY.test(e.family) && { family: e.family }),
  }
}

function imageStyleOf(e: Record<string, unknown>) {
  const duo = Array.isArray(e.duo) && e.duo.length === 2 && e.duo.every((h) => isStr(h, 9) && HEX.test(h)) ? (e.duo as [string, string]) : null
  return {
    ...(oneOf(IMAGE_FILTERS, e.filter) && { filter: e.filter }),
    ...(duo && { duo }),
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
function toElement(raw: unknown): BoardElement | null {
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
  switch (e.type) {
    case 'image':
      return isStr(e.src, Infinity) && DATA_IMAGE.test(e.src) ? { ...box, type: 'image', src: e.src, colors: strList(e.colors, (s) => HEX.test(s)), ...imageStyleOf(e) } : null
    case 'note':
      // longer text is cut, not dropped: the share API refuses it and a whole note is worth more than its tail
      return typeof e.text === 'string' ? { ...box, type: 'note', text: e.text.slice(0, MAX_TEXT), ...noteStyleOf(e) } : null
    case 'color':
      return isStr(e.hex, 9) && HEX.test(e.hex) ? { ...box, type: 'color', hex: e.hex } : null
    case 'link': {
      if (!isHttp(e.url)) return null
      const ok = e.status === 'ok'
      return {
        ...box,
        type: 'link',
        url: e.url,
        title: isStr(e.title, 500) ? e.title : null,
        image: isStr(e.image, Infinity) && DATA_IMAGE.test(e.image) ? e.image : null,
        fonts: strList(e.fonts),
        colors: strList(e.colors, (s) => HEX.test(s)),
        // a link still loading when it was saved will never finish: the one place that rule lives
        status: ok ? 'ok' : 'error',
        missing: strList(e.missing),
        ...(ok ? {} : { error: e.status === 'loading' ? 'Reading was interrupted.' : isStr(e.error, 300) ? e.error : 'Not read.' }),
      }
    }
    default:
      return null
  }
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
  const elements = data.elements.map(toElement).filter((e) => e !== null)
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
export function parseSnapshot(raw: unknown): Snapshot & { skipped: number } {
  const data = raw as { elements?: unknown; colorMeta?: unknown; board?: unknown } | null
  if (!data || !Array.isArray(data.elements)) throw new Error('That is not a Lino board.')
  const elements = data.elements.map(toElement).filter((e) => e !== null)
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
export async function openSnapshot(snap: Snapshot, mode: 'replace' | 'new' | 'readonly', opts: { view?: View; id?: string } = {}) {
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
