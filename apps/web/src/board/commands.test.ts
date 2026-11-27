import { beforeEach, expect, test, vi } from 'vitest'
import { available, command, commands, groupOf, search } from './commands.ts'
import { useBoard } from './store.ts'

const board = () => useBoard.getState()
const ids = (q = '') => search(available(commands), q).map((c) => c.id)

beforeEach(() => {
  vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 }) // node has no window; add() centers on the viewport
  vi.stubGlobal('innerWidth', 800)
  vi.stubGlobal('innerHeight', 600)
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

test('go-to commands list notes by their text, and running one selects it and centers the view', async () => {
  const { dynamicCommands } = await import('./commands.ts')
  useBoard.setState({ view: { x: 0, y: 0, zoom: 1 } })
  board().add({ type: 'note', text: 'moodboard   intro', w: 100, h: 100 }, { x: 500, y: 300 })
  board().add({ type: 'color', hex: '#fff', w: 10, h: 10 })
  const go = dynamicCommands().filter((c) => c.id.startsWith('go-'))
  expect(go.map((c) => c.label)).toEqual(['Go to moodboard intro'])
  go[0].run()
  expect(board().selectedIds).toHaveLength(1)
  expect(board().view.x).toBe(400 - 500) // add() puts the note centered on the point
})

test('other boards are listed to switch to, but not on a read-only board', async () => {
  const { dynamicCommands } = await import('./commands.ts')
  useBoard.setState({ boards: [{ id: 'a', name: 'One' }, { id: 'b', name: 'Two' }], boardId: 'a' })
  expect(dynamicCommands().map((c) => c.label)).toEqual(['Open board: Two'])
  useBoard.setState({ readOnly: true })
  expect(dynamicCommands()).toEqual([])
})

test('layouts need two elements, or a selection of two', () => {
  expect(ids()).not.toContain('layout-grid')
  board().add({ type: 'note', text: 'a', w: 10, h: 10 })
  board().add({ type: 'note', text: 'b', w: 10, h: 10 })
  expect(ids()).toContain('layout-grid')
})

test('every command is listed under its section', () => {
  expect(Object.fromEntries(commands.map((c) => [c.id, groupOf(c)]))).toMatchSnapshot()
})

test('flip toggles the selected image and does nothing for a note', () => {
  board().add({ type: 'image', src: 'x.png', w: 10, h: 10 })
  const id = board().selectedIds[0]
  command('flip-flipX').run()
  expect(board().elements[0]).toMatchObject({ id, flipX: true })
  command('flip-flipX').run()
  expect(board().elements[0]).not.toHaveProperty('flipX', true)
  board().add({ type: 'note', text: 'a', w: 10, h: 10 })
  command('flip-flipY').run()
  expect(board().elements[1]).not.toHaveProperty('flipY')
})
