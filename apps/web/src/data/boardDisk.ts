import { create } from 'zustand'
import { useBoard } from '../board/store.ts'
import { boardFileBody, boardFileName, exportBoardFile, importBoardFile } from './boardFile.ts'
import { pickDiskFile, pickDiskTarget, requestWrite, writeDiskFile } from './diskFile.ts'
import { canUseFiles, contentChanged, saveDecision, type FileLink } from './fileLink.ts'
import { captureSnapshot } from './snapshot.ts'
import { setFileLink, switchBoard } from './storage.ts'

export const supportsDiskFiles = typeof window !== 'undefined' && canUseFiles(window)

type OverwriteChoice = 'overwrite' | 'save-as' | 'cancel'
type OverwritePrompt = { name: string; choose: (choice: OverwriteChoice) => void }
export const useOverwritePrompt = create<{ prompt: OverwritePrompt | null }>(() => ({ prompt: null }))

function askOverwrite(name: string) {
  return new Promise<OverwriteChoice>((resolve) => {
    useOverwritePrompt.setState({ prompt: { name, choose: resolve } })
  }).finally(() => useOverwritePrompt.setState({ prompt: null }))
}

// A second file action cannot race the picker, prompt, or write already in progress.
let busy = false
async function runFileAction(action: () => Promise<void>, failure: string) {
  if (busy) return
  busy = true
  try {
    await action()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    const denied = e instanceof DOMException && e.name === 'NotAllowedError'
    useBoard.getState().notify(denied ? 'Lino needs permission to save to that file.' : failure)
  } finally {
    busy = false
  }
}

export function openBoardFromDisk() {
  return runFileAction(async () => {
    const handle = await pickDiskFile()
    const { boards, fileLinks } = useBoard.getState()
    for (const { id } of boards) {
      const link = fileLinks[id]
      if (link && await handle.isSameEntry(link.handle)) {
        await switchBoard(id)
        return
      }
    }
    const file = await handle.getFile()
    const id = await importBoardFile(file)
    if (id) await setFileLink(id, { handle, lastModified: file.lastModified, dirty: false })
  }, 'Could not open the board file.')
}

async function confirmTarget(link: FileLink) {
  const { handle } = link
  const file = await handle.getFile().catch((e: unknown) => {
    if (e instanceof DOMException && e.name === 'NotFoundError') return undefined
    throw e
  })
  if (!file) {
    useBoard.getState().notify('The linked file is gone; choose where to save.')
    return pickDiskTarget(boardFileName())
  }
  const decision = saveDecision(link, file.lastModified)
  if (decision === 'write') return handle
  const choice = await askOverwrite(handle.name)
  if (choice === 'overwrite') return handle
  if (choice === 'save-as') return pickDiskTarget(boardFileName())
}

async function prepareTarget(link: FileLink | undefined) {
  // Pick or ask for write access while the initiating gesture is still active.
  if (!link) return pickDiskTarget(boardFileName())
  if (!await requestWrite(link.handle)) throw new DOMException('Write permission denied', 'NotAllowedError')
  return link.handle
}

async function saveBoardToDisk(saveAs: boolean) {
  const { boardId, fileLinks } = useBoard.getState()
  const link = saveAs ? undefined : fileLinks[boardId]
  const snapshot = captureSnapshot()
  let dirty = false
  // Edits after the save started still need to be written to disk.
  const unsubscribe = useBoard.subscribe((s, prev) => {
    if (s.boardId === boardId && contentChanged(s, prev)) dirty = true
  })
  try {
    const target = await prepareTarget(link)
    const body = await boardFileBody(snapshot)
    const handle = link ? await confirmTarget(link) : target
    if (!handle || !useBoard.getState().boards.some((b) => b.id === boardId)) return
    const lastModified = await writeDiskFile(handle, body)
    await setFileLink(boardId, { handle, lastModified, dirty })
  } finally {
    unsubscribe()
  }
}

export function saveBoardFile(saveAs = false) {
  const { elements, readOnly } = useBoard.getState()
  if (!elements.length) return
  const save = supportsDiskFiles && !readOnly
    ? () => saveBoardToDisk(saveAs)
    : exportBoardFile
  return runFileAction(save, 'Could not save the board file.')
}
