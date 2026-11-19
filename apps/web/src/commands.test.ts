import { beforeEach, expect, test, vi } from 'vitest'
import { available, commands, search } from './commands.ts'
import { useBoard } from './store.ts'

const board = () => useBoard.getState()
const ids = (q = '') => search(available(commands), q).map((c) => c.id)

beforeEach(() => {
  vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 }) // node has no window; add() centers on the viewport
  useBoard.setState({ elements: [], past: [], future: [], selectedIds: [], readOnly: false })
})

test('selection commands appear only with a selection, group needs two', () => {
  expect(ids()).not.toContain('delete')
  board().add({ type: 'note', text: 'a', w: 10, h: 10 })
  expect(ids()).toContain('delete')
  expect(ids()).not.toContain('group')
  board().add({ type: 'note', text: 'b', w: 10, h: 10 })
  board().selectMany(board().elements.map((e) => e.id))
  expect(ids()).toContain('group')
})

test('a read-only board offers no editing command, only view ones', () => {
  board().add({ type: 'note', text: 'a', w: 10, h: 10 })
  useBoard.setState({ readOnly: true })
  expect(ids()).toEqual(expect.arrayContaining(['zoom-in', 'fit']))
  expect(ids()).not.toContain('add-note')
  expect(ids()).not.toContain('delete')
})

test('search matches label words and keywords, best match first, empty query keeps order', () => {
  expect(ids('note')[0]).toBe('add-note')
  expect(ids('sticky')).toContain('add-note')
  expect(ids('zzzz')).toEqual([])
  expect(ids()).toEqual(available(commands).map((c) => c.id))
})

test('run does the action', () => {
  commands.find((c) => c.id === 'add-note')!.run()
  expect(board().elements).toHaveLength(1)
})
