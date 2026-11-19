import { expect, test, vi } from 'vitest'
import { captureSnapshot, openSnapshot, parseSnapshot as parseBoard, parseSnapshotText as parseBoardFile } from './snapshot.ts'
import { useBoard } from './store.ts'

vi.stubGlobal('innerWidth', 1000)
vi.stubGlobal('innerHeight', 800)

const box = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }

test('parseBoardFile keeps valid elements, drops unsafe ones and unknown fields', () => {
  const file = JSON.stringify({
    app: 'lino',
    version: 1,
    elements: [
      { ...box, id: 'a', type: 'note', text: 'hi', extra: 'dropped' },
      { ...box, id: 'b', type: 'color', hex: '#abc' },
      { ...box, id: 'c', type: 'link', url: 'javascript:alert(1)', title: 'x', image: null, fonts: [], colors: [], status: 'ok', missing: [] },
      { ...box, id: 'd', type: 'image', src: 'https://tracker.example/x.png' },
      { ...box, id: 'e', type: 'link', url: 'https://example.com/', title: 'Ex', image: null, fonts: ['Inter'], colors: ['#112233', 'red'], status: 'loading', missing: [] },
      { id: 'f', type: 'note', text: 'no box' },
    ],
    colorMeta: { '#ABC': { name: 'sky', pinned: true, evil: 1 }, notahex: { name: 'x' } },
  })
  const { elements, colorMeta, skipped } = parseBoardFile(file)
  expect(elements.map((e) => e.type)).toEqual(['note', 'color', 'link'])
  expect(skipped).toBe(3)
  expect(elements[0]).not.toHaveProperty('extra')
  expect(elements[0].id).not.toBe('a') // fresh ids
  expect(elements[2]).toMatchObject({ status: 'error', colors: ['#112233'], fonts: ['Inter'] })
  expect(colorMeta).toEqual({ '#abc': { name: 'sky', pinned: true } })
})

test('parseBoardFile rejects files that are not boards', () => {
  expect(() => parseBoardFile('not json')).toThrow('not a Lino board')
  expect(() => parseBoardFile('{"foo":1}')).toThrow('not a Lino board')
  expect(() => parseBoardFile('null')).toThrow('not a Lino board')
})

test('parseBoardFile keeps valid note text styles and drops bad ones', () => {
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'note', text: 'a', color: '#112233', align: 'center', bold: true, italic: true, size: 'xl' },
      { ...box, type: 'note', text: 'b', color: 'red', align: 'justify', bold: 'yes', italic: 1 },
    ],
  })
  const { elements } = parseBoardFile(file)
  expect(elements[0]).toMatchObject({ color: '#112233', align: 'center', bold: true, italic: true, size: 'xl' })
  for (const k of ['color', 'align', 'bold', 'italic']) expect(elements[1]).not.toHaveProperty(k)
})

test('parseBoardFile keeps valid style fields and the board style, drops bad ones', () => {
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'note', text: 'a', bg: '#fff3b0', size: 'lg', font: 'serif', family: 'Space Grotesk', corner: 'round', shadow: false, opacity: 0.05 },
      { ...box, type: 'note', text: 'b', bg: 'url(x)', size: 'huge', corner: '9px', shadow: 'no', family: 'x", serif; } body { color: red' },
      { ...box, type: 'color', hex: '#000', bg: '#fff', size: 'lg', deco: 'pin' },
    ],
    board: { bg: '#1e3a5f', pattern: 'grid', messy: true, extra: 1 },
  })
  const { elements, board } = parseBoardFile(file)
  expect(elements[0]).toMatchObject({ bg: '#fff3b0', size: 'lg', font: 'serif', family: 'Space Grotesk', corner: 'round', shadow: false, opacity: 0.2 })
  for (const k of ['bg', 'size', 'corner', 'shadow', 'family']) expect(elements[1]).not.toHaveProperty(k)
  expect(elements[2]).not.toHaveProperty('bg')
  expect(board).toEqual({ bg: '#1e3a5f', pattern: 'grid', messy: true })
  expect(elements[2]).toMatchObject({ deco: 'pin' })
  expect(parseBoardFile(JSON.stringify({ elements: [] })).board).toEqual({})
})

test('parseBoardFile keeps image filters only when valid', () => {
  const src = 'data:image/png;base64,AA=='
  const { elements } = parseBoardFile(
    JSON.stringify({
      elements: [
        { ...box, type: 'image', src, filter: 'duotone', duo: ['#102030', '#f0e0d0'] },
        { ...box, type: 'image', src, filter: 'sepia', duo: ['#000', 'url(x)'] },
        { ...box, type: 'note', text: 'x', filter: 'mono' },
      ],
    }),
  )
  expect(elements[0]).toMatchObject({ filter: 'duotone', duo: ['#102030', '#f0e0d0'] })
  for (const e of elements.slice(1)) expect(e).not.toHaveProperty('filter')
  expect(elements[1]).not.toHaveProperty('duo')
})

test('parseBoard (shared snapshots too) drops unparseable links and keeps boxes within limits', () => {
  const link = { type: 'link', title: null, image: null, fonts: [], colors: [], status: 'ok', missing: [] }
  const { elements, colorMeta } = parseBoard({
    elements: [
      { ...box, ...link, url: 'https://' },
      { ...box, type: 'color', hex: '#abc', x: 1e308, y: -1e308, w: 1e9 },
    ],
    colorMeta: { 'red;}body{display:none}': { pinned: true } },
  })
  expect(elements).toHaveLength(1)
  expect(elements[0]).toMatchObject({ x: 1e6, y: -1e6, w: 10_000, h: 10 })
  expect(colorMeta).toEqual({})
})

test('limits match the share API (pinned in apps/api/src/routes.test.ts)', () => {
  const { elements } = parseBoard({
    elements: [{ ...box, type: 'note', text: 'x'.repeat(10_001), x: -1e9, y: 1e9, w: 0.5, h: 1e9 }],
  })
  expect(elements[0]).toMatchObject({ x: -1e6, y: 1e6, w: 1, h: 10_000 })
  expect((elements[0] as { text: string }).text).toHaveLength(10_000)
})

test('a link still loading comes back as an interrupted error', () => {
  const { elements } = parseBoard({
    elements: [{ ...box, type: 'link', url: 'https://example.com/', title: null, image: null, fonts: [], colors: [], status: 'loading', missing: [] }],
  })
  expect(elements[0]).toMatchObject({ status: 'error', error: 'Reading was interrupted.' })
})

const reset = () => useBoard.setState({ elements: [], colorMeta: {}, board: {}, readOnly: false, selectedIds: [], past: [], future: [], guides: [], boards: [{ id: 'a', name: 'A' }], boardId: 'a' })
const sample = { elements: [{ ...box, type: 'note', text: 'hi' }, { ...box, type: 'color', hex: '#abc' }], colorMeta: { '#abc': { pinned: true } }, board: { bg: '#112233' } }
const same = () => {
  const { elements, colorMeta, board } = captureSnapshot()
  return { types: elements.map((e) => e.type), colorMeta, board }
}
const expected = { types: ['note', 'color'], colorMeta: { '#abc': { pinned: true } }, board: { bg: '#112233' } }

test('open replace: round-trips as one undo step', async () => {
  reset()
  await openSnapshot(parseBoard(JSON.parse(JSON.stringify(sample))), 'replace')
  expect(same()).toEqual(expected)
  expect(useBoard.getState().past).toHaveLength(1)
})

test('open new: round-trips as another board with a clean history', async () => {
  reset()
  useBoard.setState({ selectedIds: ['x'], past: [{} as never] })
  await openSnapshot(parseBoard(sample), 'new')
  const s = useBoard.getState()
  expect(same()).toEqual(expected)
  expect(s.boards).toHaveLength(2)
  expect(s.boardId).toBe(s.boards[1].id)
  expect([s.past, s.selectedIds]).toEqual([[], []])
})

test('open readonly: round-trips with a clean history and keeps the board id', async () => {
  reset()
  useBoard.setState({ past: [{} as never] })
  await openSnapshot(parseBoard(sample), 'readonly')
  const s = useBoard.getState()
  expect(same()).toEqual(expected)
  expect([s.readOnly, s.boardId, s.past]).toEqual([true, 'a', []])
})

test('lock, flip and crop survive a round trip; a bad crop is clamped or dropped', () => {
  const src = 'data:image/png;base64,AA=='
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'image', src, locked: true, flipX: true, flipY: 'yes', crop: { x: 0.9, y: 0, w: 0.5, h: 0.5 } },
      { ...box, type: 'image', src, locked: 'true', crop: { x: 'a', y: 0, w: 1, h: 1 } },
      { ...box, type: 'note', text: 'n', locked: true },
    ],
  })
  const { elements } = parseBoardFile(file)
  expect(elements[0]).toMatchObject({ locked: true, flipX: true, crop: { x: 0.5, y: 0, w: 0.5, h: 0.5 } })
  expect(elements[0]).not.toHaveProperty('flipY')
  for (const k of ['locked', 'crop']) expect(elements[1]).not.toHaveProperty(k)
  expect(elements[2]).toMatchObject({ locked: true })
  const again = parseBoardFile(JSON.stringify({ elements }))
  expect(again.elements.map(({ id, ...e }) => e)).toEqual(elements.map(({ id, ...e }) => e))
})

test('frames, groupId and headings survive a round trip, bad values are dropped', () => {
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'frame', title: 'Moods', groupId: 'g1' },
      { ...box, type: 'frame', title: 5 },
      { ...box, type: 'note', text: 'H', heading: true, groupId: 'g1' },
      { ...box, type: 'note', text: 'n', heading: 'yes', groupId: 7 },
    ],
  })
  const { elements, skipped } = parseBoardFile(file)
  expect(skipped).toBe(1)
  expect(elements[0]).toMatchObject({ type: 'frame', title: 'Moods', groupId: 'g1' })
  expect(elements[1]).toMatchObject({ heading: true, groupId: 'g1' })
  for (const k of ['heading', 'groupId']) expect(elements[2]).not.toHaveProperty(k)
  const again = parseBoardFile(JSON.stringify({ elements }))
  expect(again.elements.map(({ id, ...e }) => e)).toEqual(elements.map(({ id, ...e }) => e))
})
