import { afterAll, beforeEach, expect, test, vi } from 'vitest'
import { useBoard, type BoardElement } from '../board/store.ts'
import type { DiskHandle } from './fileLink.ts'

const records = new Map<string, unknown>()
vi.mock('./db.ts', () => ({
  run: async (_store: string, _mode: string, fn: (store: unknown) => { result: unknown }) =>
    fn({
      get: (key: string) => ({ result: records.get(key) }),
      put: (value: unknown, key: string) => ({ result: records.set(key, value) }),
    }).result,
}))

const openPicker = vi.fn<() => Promise<DiskHandle[]>>()
const savePicker = vi.fn<() => Promise<DiskHandle>>()
const download = vi.fn(() => ({ click() {} }))
vi.stubGlobal('window', { showOpenFilePicker: openPicker, showSaveFilePicker: savePicker })
vi.stubGlobal('innerWidth', 800)
vi.stubGlobal('innerHeight', 600)
vi.stubGlobal('document', { createElement: download })
const { openBoardFromDisk, saveBoardFile, useOverwritePrompt } = await import('./boardDisk.ts')
const { available, commands, runCommand } = await import('../board/commands.ts')
const { boardKey } = await import('../board/keys.ts')

const box = { x: 0, y: 0, w: 100, h: 50, rotation: 0 }
const note = { ...box, id: 'note', type: 'note', text: 'Before' } satisfies BoardElement
const frame = { ...box, id: 'frame', type: 'frame', title: 'Before' } satisfies BoardElement
const board = useBoard.getState
const currentLink = () => board().fileLinks[board().boardId]

function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

function disk(name = 'board.lino.json', lastModified = 10) {
  let body = JSON.stringify({ elements: [note] })
  const stream = {
    write: vi.fn(async (text: string) => { body = text }),
    close: vi.fn(async () => { lastModified++ }),
    abort: vi.fn(async () => {}),
  }
  const handle = {
    name,
    kind: 'file',
    getFile: vi.fn(async () => new File([body], name, { lastModified })),
    createWritable: vi.fn(async () => stream as unknown as FileSystemWritableFileStream),
    isSameEntry: async (other: FileSystemHandle) => other.name === name,
    queryPermission: vi.fn(async (): Promise<PermissionState> => 'granted'),
    requestPermission: vi.fn(async (): Promise<PermissionState> => 'granted'),
  } satisfies DiskHandle
  return { handle, stream, snapshot: () => JSON.parse(body) }
}

function link(handle: DiskHandle, id = 'local') {
  const entry = { handle, lastModified: 10, dirty: true }
  useBoard.setState((s) => ({ fileLinks: { ...s.fileLinks, [id]: entry } }))
  return entry
}

beforeEach(() => {
  vi.resetAllMocks()
  records.clear()
  useBoard.setState({ ...useBoard.getInitialState(), elements: [note] })
})

afterAll(() => vi.unstubAllGlobals())

test('Open switches to an already linked board without importing the file again', async () => {
  const stored = disk()
  const picked = disk()
  records.set('other', { elements: [{ ...note, text: 'Browser copy' }] })
  useBoard.setState({ boards: [...board().boards, { id: 'other', name: 'Other board' }] })
  const entry = link(stored.handle, 'other')
  openPicker.mockResolvedValueOnce([picked.handle])

  await openBoardFromDisk()

  expect(board().boardId).toBe('other')
  expect(board().boards).toHaveLength(2)
  expect(board().elements[0]).toMatchObject({ text: 'Browser copy' })
  expect(currentLink()).toBe(entry)
  expect(picked.handle.getFile).not.toHaveBeenCalled()
})

test('Open preserves the link of an empty board by opening a new board', async () => {
  useBoard.setState({ elements: [] })
  const entry = link(disk('original.lino.json').handle)
  const { handle } = disk()
  openPicker.mockResolvedValueOnce([handle])

  await openBoardFromDisk()

  expect(board().boardId).not.toBe('local')
  expect(board().boards).toHaveLength(2)
  expect(board().fileLinks.local).toBe(entry)
  expect(currentLink()).toEqual({ handle, lastModified: 10, dirty: false })
})

test('a failed write leaves the link and dirty flag unchanged and shows a generic error', async () => {
  const { handle, stream } = disk()
  const entry = link(handle)
  stream.write.mockRejectedValueOnce(new DOMException('Internal disk error', 'UnknownError'))

  await saveBoardFile()

  expect(stream.abort).toHaveBeenCalledOnce()
  expect(currentLink()).toBe(entry)
  expect(board().notice).toBe('Could not save the board file.')
})

test('an edit during an in-flight save keeps the board dirty', async () => {
  const file = disk()
  const writing = gate()
  const finish = gate()
  file.stream.close.mockImplementationOnce(async () => {
    writing.release()
    await finish.promise
  })
  link(file.handle)

  const saving = saveBoardFile()
  await writing.promise
  board().update(note.id, { text: 'During save' })
  finish.release()
  await saving

  expect(file.snapshot().elements[0].text).toBe('Before')
  expect(board().elements[0]).toMatchObject({ text: 'During save' })
  expect(currentLink()?.dirty).toBe(true)
})

test.each(['overwrite', 'save-as', 'cancel'] as const)('handles overwrite choice %s', async (choice) => {
  const original = disk('changed.lino.json', 20)
  const copy = disk('copy.lino.json')
  const entry = link(original.handle)
  if (choice === 'save-as') savePicker.mockResolvedValueOnce(copy.handle)

  const saving = saveBoardFile()
  const prompt = await vi.waitFor(() => {
    const active = useOverwritePrompt.getState().prompt
    expect(active?.name).toBe(original.handle.name)
    return active!
  })
  prompt.choose(choice)
  await saving

  expect(original.stream.write).toHaveBeenCalledTimes(choice === 'overwrite' ? 1 : 0)
  expect(savePicker).toHaveBeenCalledTimes(choice === 'save-as' ? 1 : 0)
  expect(copy.stream.write).toHaveBeenCalledTimes(choice === 'save-as' ? 1 : 0)
  if (choice === 'cancel') expect(currentLink()).toBe(entry)
  else expect(currentLink()).toMatchObject({ handle: choice === 'overwrite' ? original.handle : copy.handle, dirty: false })
  expect(useOverwritePrompt.getState().prompt).toBeNull()
})

test('a missing linked file prompts for a new save target', async () => {
  const missing = disk()
  const copy = disk('copy.lino.json')
  link(missing.handle)
  missing.handle.getFile.mockRejectedValueOnce(new DOMException('Missing entry', 'NotFoundError'))
  savePicker.mockResolvedValueOnce(copy.handle)

  await saveBoardFile()

  expect(board().notice).toBe('The linked file is gone; choose where to save.')
  expect(savePicker).toHaveBeenCalledOnce()
  expect(copy.stream.write).toHaveBeenCalledOnce()
  expect(missing.stream.write).not.toHaveBeenCalled()
  expect(currentLink()).toEqual({ handle: copy.handle, lastModified: 11, dirty: false })
})

test.each(['NotAllowedError', 'AbortError'] as const)('handles picker error %s', async (name) => {
  savePicker.mockRejectedValueOnce(new DOMException('Raw picker details', name))

  await saveBoardFile(true)

  expect(board().notice).toBe(name === 'NotAllowedError' ? 'Lino needs permission to save to that file.' : null)
})

test('handles a denied write permission', async () => {
  const file = disk()
  link(file.handle)
  file.handle.queryPermission.mockResolvedValueOnce('prompt')
  file.handle.requestPermission.mockResolvedValueOnce('denied')

  await saveBoardFile()

  expect(board().notice).toBe('Lino needs permission to save to that file.')
  expect(file.stream.write).not.toHaveBeenCalled()
})

test.each([false, true])('saving an empty board does nothing (download path: %s)', async (readOnly) => {
  useBoard.setState({ elements: [], readOnly })
  const target = disk()
  savePicker.mockResolvedValue(target.handle)

  await saveBoardFile()
  await saveBoardFile(true)

  expect(available(commands).map((c) => c.id)).not.toContain('save')
  expect(available(commands).map((c) => c.id)).not.toContain('save-as')
  expect(savePicker).not.toHaveBeenCalled()
  expect(download).not.toHaveBeenCalled()
})

test('the save shortcut captures note text and frame title already written by their change handlers', async () => {
  const file = disk()
  link(file.handle)
  useBoard.setState({ elements: [note, frame] })
  board().update(note.id, { text: 'Latest text' })
  board().update(frame.id, { title: 'Latest title' })
  const action = boardKey({ key: 's', code: 'KeyS', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, false, true)
  expect(action).toEqual({ id: 'save', preventDefault: true })

  await runCommand(action!.id)

  expect(file.snapshot().elements).toMatchObject([{ text: 'Latest text' }, { title: 'Latest title' }])
})
