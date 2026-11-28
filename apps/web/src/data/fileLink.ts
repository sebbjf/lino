import type { Snapshot } from './snapshot.ts'

export interface DiskHandle extends FileSystemFileHandle {
  queryPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission(options: { mode: 'readwrite' }): Promise<PermissionState>
}

export type FileLink = { handle: DiskHandle; lastModified: number; dirty: boolean }

export function canUseFiles(win: object) {
  return 'showOpenFilePicker' in win && typeof win.showOpenFilePicker === 'function'
    && 'showSaveFilePicker' in win && typeof win.showSaveFilePicker === 'function'
}

export function saveDecision(link: Pick<FileLink, 'lastModified'>, fileLastModified: number) {
  return fileLastModified === link.lastModified ? 'write' : 'ask-overwrite'
}

export function showUnsavedDot(supported: boolean, link?: Pick<FileLink, 'dirty'>) {
  return supported && link?.dirty === true
}

type BoardContent = Snapshot & { boardId: string }

export function contentChanged(next: BoardContent, prev: BoardContent) {
  return next.boardId === prev.boardId && (
    next.elements !== prev.elements || next.colorMeta !== prev.colorMeta || next.board !== prev.board
  )
}
