import { capturePortable, openSnapshot, parseSnapshotText } from './snapshot.ts'
import { useBoard } from './store.ts'

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
  const body = JSON.stringify({ app: 'lino', version: 1, ...(await capturePortable()) })
  download(new Blob([body], { type: 'application/json' }), `lino-board-${new Date().toISOString().slice(0, 10)}.lino.json`)
}

/** Opens a file's contents: on the board itself if it is empty, otherwise as a new board, so nothing is replaced. */
export async function importBoardFile(file: File) {
  const { notify } = useBoard.getState()
  try {
    if (file.size > MAX_FILE) throw new Error('That file is larger than 50 MB.')
    const { skipped, ...snap } = parseSnapshotText(await file.text())
    if (!snap.elements.length) throw new Error('That board file has nothing to show.')
    const kept = useBoard.getState().elements.length > 0
    await openSnapshot(snap, kept ? 'new' : 'replace')
    const note = skipped ? ` ${skipped} unreadable ${skipped === 1 ? 'item was' : 'items were'} skipped.` : ''
    notify(`${kept ? 'Imported as a new board; the one you had is still in your boards.' : 'Board imported.'}${note}`)
  } catch (e) {
    notify((e as Error).message)
  }
}

export const isBoardFile = (f: File) => f.name.endsWith('.json') || f.type === 'application/json'
