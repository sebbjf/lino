import { capturePortable, openSnapshot, parseSnapshotText, type Snapshot } from './snapshot.ts'
import { useBoard } from '../board/store.ts'

const MAX_FILE = 50 * 1024 * 1024

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Downloads the board as a .lino.json file that importBoardFile reads back. */
export async function exportBoardFile() {
  download(new Blob([await boardFileBody()], { type: 'application/json' }), boardFileName())
}

export const boardFileName = () => `lino-board-${new Date().toISOString().slice(0, 10)}.lino.json`

export async function boardFileBody(snap?: Snapshot) {
  return JSON.stringify({ app: 'lino', version: 1, ...(await capturePortable(snap)) })
}

/** Opens a file in place only when the current board is empty and unlinked. */
export async function importBoardFile(file: File) {
  const { notify } = useBoard.getState()
  try {
    if (file.size > MAX_FILE) throw new Error('That file is larger than 50 MB.')
    const { skipped, ...snap } = parseSnapshotText(await file.text())
    if (!snap.elements.length) throw new Error('That board file has nothing to show.')
    const { elements, boardId, fileLinks } = useBoard.getState()
    const kept = elements.length > 0 || !!fileLinks[boardId]
    const id = await openSnapshot(snap, kept ? 'new' : 'replace')
    const note = skipped ? ` ${skipped} unreadable ${skipped === 1 ? 'item was' : 'items were'} skipped.` : ''
    notify(`${kept ? 'Imported as a new board; the one you had is still in your boards.' : 'Board imported.'}${note}`)
    return id
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    notify(e instanceof Error && !(e instanceof DOMException) ? e.message : 'Could not open the board file.')
  }
}

export const isBoardFile = (f: File) => f.name.endsWith('.json') || f.type === 'application/json'
