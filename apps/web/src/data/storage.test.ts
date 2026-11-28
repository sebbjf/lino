import { beforeEach, expect, test, vi } from 'vitest'
import { useBoard, type BoardElement } from '../board/store.ts'

// The 'boards' object store, in memory: what storage.ts reads and writes through run().
const mem = new Map<string, unknown>()
vi.mock('./db.ts', () => ({
  run: async (_store: string, _mode: string, fn: (s: unknown) => { result: unknown }) =>
    fn({
      get: (k: string) => ({ result: structuredClone(mem.get(k)) }),
      put: (v: unknown, k: string) => (mem.set(k, structuredClone(v)), { result: k }),
      delete: (k: string) => (mem.delete(k), { result: undefined }),
      getAll: () => ({ result: [...mem.values()] }),
    }).result,
}))
const { deleteBoard, loadBoard, renameBoard, saveAsLocalBoard, setFileLink, startAutosave, switchBoard } = await import('./storage.ts')

const note = (id: string, text: string) => ({ id, type: 'note', text, x: 0, y: 0, w: 100, h: 50, rotation: 0 }) as BoardElement
const board = () => useBoard.getState()

beforeEach(() => {
  mem.clear()
  vi.stubGlobal('innerWidth', 1200)
  vi.stubGlobal('innerHeight', 800)
  useBoard.setState({ boards: [{ id: 'local', name: 'My board' }], boardId: 'local', fileLinks: {}, elements: [], view: { x: 0, y: 0, zoom: 1 }, readOnly: false, exportPrefs: { prefix: '', format: 'hex' } })
})

test('loading an old board moves its view into its own record and opens the current board', async () => {
  mem.set('index', { current: 'b2', boards: [{ id: 'local', name: 'One' }, { id: 'b2', name: 'Two' }] })
  mem.set('b2', { elements: [note('n', 'hi')], colorMeta: {}, board: {}, view: { x: 5, y: 6, zoom: 2 } })
  await loadBoard()
  expect(board().boardId).toBe('b2')
  expect(board().elements.map((e) => e.type === 'note' && e.text)).toEqual(['hi'])
  expect(board().view).toEqual({ x: 5, y: 6, zoom: 2 })
  expect(mem.get('b2:view')).toEqual({ x: 5, y: 6, zoom: 2 })
})

test('switching saves the open board first, then shows the other one', async () => {
  useBoard.setState({ boards: [{ id: 'local', name: 'One' }, { id: 'b2', name: 'Two' }], elements: [note('a', 'mine')] })
  mem.set('b2', { elements: [note('b', 'other')], colorMeta: {}, board: {} })
  await switchBoard('b2')
  expect((mem.get('local') as { elements: BoardElement[] }).elements.map((e) => e.id)).toEqual(['a'])
  expect(mem.get('index')).toMatchObject({ current: 'local' })
  expect(board().boardId).toBe('b2')
  expect(board().elements.map((e) => e.type === 'note' && e.text)).toEqual(['other'])
})

test('saving a shared board locally adds it to the index as the current board', async () => {
  await saveAsLocalBoard({ elements: [note('s', 'shared')], colorMeta: {}, board: {} }, 'From a link')
  const index = mem.get('index') as { current: string; boards: { id: string; name: string }[] }
  expect(index.boards.map((b) => b.name)).toEqual(['My board', 'From a link'])
  expect((mem.get(index.current) as { elements: BoardElement[] }).elements.map((e) => e.id)).toEqual(['s'])
})

test('rename trims and caps the name, and ignores a blank one', () => {
  renameBoard('local', `  ${'x'.repeat(80)}  `)
  expect(board().boards[0].name).toBe('x'.repeat(60))
  renameBoard('local', '   ')
  expect(board().boards[0].name).toBe('x'.repeat(60))
})

test('deleting drops the record, view and file link; deleting the last board leaves a fresh one', async () => {
  mem.set('local', { elements: [] })
  mem.set('local:view', { x: 0, y: 0, zoom: 1 })
  mem.set('local:file', { lastModified: 10, dirty: true })
  await deleteBoard('local')
  expect([...mem.keys()]).toEqual([])
  expect(board().boards).toHaveLength(1)
  expect(board().boards[0].id).not.toBe('local')
  expect(board().boardId).toBe(board().boards[0].id)
})

test('autosave debounces edits and persists a dirty file link only for content changes', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('document', { addEventListener: () => {} })
  startAutosave()
  board().setView({ x: 1, y: 2, zoom: 1 })
  board().setView({ x: 3, y: 4, zoom: 1 })
  expect(mem.size).toBe(0)
  await vi.advanceTimersByTimeAsync(300)
  expect([...mem.keys()]).toEqual(['local:view'])
  expect(mem.get('local:view')).toEqual({ x: 3, y: 4, zoom: 1 })
  board().add({ type: 'note', text: 'n', w: 10, h: 10 }, { x: 0, y: 0 })
  await vi.advanceTimersByTimeAsync(300)
  expect([...mem.keys()].sort()).toEqual(['index', 'local', 'local:view'])

  const savedLink = { handle: { kind: 'file', name: 'board.lino.json' }, lastModified: 10, dirty: false }
  mem.set('local:file', savedLink)
  vi.stubGlobal('window', { showOpenFilePicker() {}, showSaveFilePicker() {} })
  await loadBoard()
  expect(board().fileLinks.local).toEqual(savedLink)
  board().setView({ x: 0, y: 0, zoom: 2 })
  await vi.advanceTimersByTimeAsync(300)
  expect(board().fileLinks.local?.dirty).toBe(false)
  expect(mem.get('local:file')).toEqual(savedLink)
  board().add({ type: 'note', text: 'edited', w: 10, h: 10 }, { x: 0, y: 0 })
  expect(board().fileLinks.local?.dirty).toBe(true)
  await vi.advanceTimersByTimeAsync(300)
  expect(mem.get('local:file')).toEqual({ ...savedLink, dirty: true })
  await setFileLink('local', { ...board().fileLinks.local!, lastModified: 20, dirty: false })
  expect(board().fileLinks.local?.dirty).toBe(false)
  expect(mem.get('local:file')).toEqual({ ...savedLink, lastModified: 20 })
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
