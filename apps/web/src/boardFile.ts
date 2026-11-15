import type { ColorMeta } from './colors.ts'
import { fitView } from './geometry.ts'
import { useBoard, type BoardElement } from './store.ts'

const MAX_FILE = 50 * 1024 * 1024
const HEX = /^#[0-9a-f]{3,8}$/i
const DATA_IMAGE = /^data:image\/(png|jpeg|webp|gif);base64,/

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown, max = 10_000): v is string => typeof v === 'string' && v.length <= max
const strList = (v: unknown, ok: (s: string) => boolean = () => true) =>
  Array.isArray(v) ? v.filter((s): s is string => isStr(s, 200) && ok(s)).slice(0, 20) : []
const isHttp = (v: unknown): v is string => {
  try {
    return isStr(v, 2048) && /^https?:$/.test(new URL(v).protocol)
  } catch {
    return false
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
  const box = { id: crypto.randomUUID(), x: e.x, y: e.y, w: e.w, h: e.h, rotation: isNum(e.rotation) ? e.rotation : 0 }
  switch (e.type) {
    case 'image':
      return isStr(e.src, Infinity) && DATA_IMAGE.test(e.src) ? { ...box, type: 'image', src: e.src } : null
    case 'note':
      return isStr(e.text) ? { ...box, type: 'note', text: e.text } : null
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
        // a link that was still loading when exported will never finish
        status: ok ? 'ok' : 'error',
        missing: strList(e.missing),
        ...(ok ? {} : { error: isStr(e.error, 300) ? e.error : 'Not read.' }),
      }
    }
    default:
      return null
  }
}

/** Parses a board file (or a shared-board snapshot). Unusable elements are dropped and counted. */
export function parseBoardFile(text: string) {
  let data: { elements?: unknown; colorMeta?: unknown } | null
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('That file is not a Lino board.')
  }
  if (!data || !Array.isArray(data.elements)) throw new Error('That file is not a Lino board.')
  const elements = data.elements.map(toElement).filter((e) => e !== null)
  const colorMeta: Record<string, ColorMeta> = {}
  if (data.colorMeta && typeof data.colorMeta === 'object')
    for (const [hex, m] of Object.entries(data.colorMeta as Record<string, Record<string, unknown> | null>)) {
      if (!HEX.test(hex) || !m || typeof m !== 'object') continue
      colorMeta[hex.toLowerCase()] = {
        ...(isStr(m.name, 60) && { name: m.name }),
        ...(typeof m.pinned === 'boolean' && { pinned: m.pinned }),
        ...(typeof m.hidden === 'boolean' && { hidden: m.hidden }),
      }
    }
  return { elements, colorMeta, skipped: data.elements.length - elements.length }
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downloads the board as a .lino.json file that importBoardFile reads back. */
export function exportBoardFile() {
  const { elements, colorMeta } = useBoard.getState()
  const body = JSON.stringify({ app: 'lino', version: 1, elements, colorMeta })
  download(new Blob([body], { type: 'application/json' }), `lino-board-${new Date().toISOString().slice(0, 10)}.lino.json`)
}

/** Replaces the board with a file's contents. Undo brings the previous board back. */
export async function importBoardFile(file: File) {
  const { notify } = useBoard.getState()
  try {
    if (file.size > MAX_FILE) throw new Error('That file is larger than 50 MB.')
    const { elements, colorMeta, skipped } = parseBoardFile(await file.text())
    if (!elements.length) throw new Error('That board file has nothing to show.')
    useBoard.getState().replaceBoard(elements, colorMeta)
    useBoard.getState().setView(fitView(elements, innerWidth, innerHeight))
    const note = skipped ? ` ${skipped} unreadable ${skipped === 1 ? 'item was' : 'items were'} skipped.` : ''
    notify(`Board imported.${note} Ctrl+Z brings the old one back.`)
  } catch (e) {
    notify((e as Error).message)
  }
}

export const isBoardFile = (f: File) => f.name.endsWith('.json') || f.type === 'application/json'
