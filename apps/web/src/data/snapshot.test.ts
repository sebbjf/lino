import { expect, test, vi } from 'vitest'
import { captureSnapshot, openSnapshot, parseSnapshot, parseSnapshotText } from './snapshot.ts'
import { useBoard } from '../board/store.ts'

vi.stubGlobal('innerWidth', 1000)
vi.stubGlobal('innerHeight', 800)

const box = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }

test('parseSnapshotText keeps valid elements, drops unsafe ones and unknown fields', () => {
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
  const { elements, colorMeta, skipped } = parseSnapshotText(file)
  expect(elements.map((e) => e.type)).toEqual(['note', 'color', 'link'])
  expect(skipped).toBe(3)
  expect(elements[0]).not.toHaveProperty('extra')
  expect(elements[0].id).not.toBe('a') // fresh ids
  expect(elements[2]).toMatchObject({ status: 'error', colors: ['#112233'], fonts: ['Inter'] })
  expect(colorMeta).toEqual({ '#abc': { name: 'sky', pinned: true } })
})

test('parseSnapshotText rejects files that are not boards', () => {
  expect(() => parseSnapshotText('not json')).toThrow('not a Lino board')
  expect(() => parseSnapshotText('{"foo":1}')).toThrow('not a Lino board')
  expect(() => parseSnapshotText('null')).toThrow('not a Lino board')
})

test.each([{ type: 'constructor' }, { type: '__proto__' }, { type: ['note'] }, { type: 1 }])(
  'skips invalid kind $type and opens the remaining board',
  async ({ type }) => {
    const { skipped, ...snap } = parseSnapshotText(JSON.stringify({
      elements: [{ ...box, type, text: 'skip me' }, { ...box, type: 'note', text: 'keep me' }],
    }))
    expect(skipped).toBe(1)
    expect(snap.elements).toMatchObject([{ type: 'note', text: 'keep me' }])
    await openSnapshot(snap, 'readonly')
    expect(useBoard.getState().elements).toEqual(snap.elements)
  },
)

test.each(['#12345', '#1234567'])('rejects invalid hex length in %s across board fields', (hex) => {
  const { elements, skipped, board, colorMeta } = parseSnapshotText(JSON.stringify({
    elements: [
      { ...box, type: 'color', hex },
      { ...box, type: 'color', hex: '#1234' },
      { ...box, type: 'note', text: 'hi', bg: hex, color: '#12345678' },
      { ...box, type: 'image', src: 'data:image/png;base64,AA==', colors: [hex, '#abc'], duo: [hex, '#fff'] },
      { ...box, type: 'link', url: 'https://example.com/', colors: [hex, '#123456'] },
    ],
    board: { bg: hex },
    colorMeta: { [hex]: { pinned: true }, '#ABCD': { pinned: true } },
  }))
  expect(skipped).toBe(1)
  expect(elements).toMatchObject([
    { type: 'color', hex: '#1234' },
    { type: 'note', color: '#12345678' },
    { type: 'image', colors: ['#abc'] },
    { type: 'link', colors: ['#123456'] },
  ])
  expect(elements[1]).not.toHaveProperty('bg')
  expect(elements[2]).not.toHaveProperty('duo')
  expect(board).toEqual({})
  expect(colorMeta).toEqual({ '#abcd': { pinned: true } })
})

test('parseSnapshotText keeps valid note text styles and drops bad ones', () => {
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'note', text: 'a', color: '#112233', align: 'center', bold: true, italic: true, size: 'xl' },
      { ...box, type: 'note', text: 'b', color: 'red', align: 'justify', bold: 'yes', italic: 1 },
    ],
  })
  const { elements } = parseSnapshotText(file)
  expect(elements[0]).toMatchObject({ color: '#112233', align: 'center', bold: true, italic: true, size: 'xl' })
  for (const k of ['color', 'align', 'bold', 'italic']) expect(elements[1]).not.toHaveProperty(k)
})

test('parseSnapshotText keeps valid style fields and the board style, drops bad ones', () => {
  const file = JSON.stringify({
    elements: [
      { ...box, type: 'note', text: 'a', bg: '#fff3b0', size: 'lg', font: 'serif', family: 'Space Grotesk', corner: 'round', shadow: false, opacity: 0.05 },
      { ...box, type: 'note', text: 'b', bg: 'url(x)', size: 'huge', corner: '9px', shadow: 'no', family: 'x", serif; } body { color: red' },
      { ...box, type: 'color', hex: '#000', bg: '#fff', size: 'lg', deco: 'pin' },
    ],
    board: { bg: '#1e3a5f', pattern: 'grid', messy: true, extra: 1 },
  })
  const { elements, board } = parseSnapshotText(file)
  expect(elements[0]).toMatchObject({ bg: '#fff3b0', size: 'lg', font: 'serif', family: 'Space Grotesk', corner: 'round', shadow: false, opacity: 0.2 })
  for (const k of ['bg', 'size', 'corner', 'shadow', 'family']) expect(elements[1]).not.toHaveProperty(k)
  expect(elements[2]).not.toHaveProperty('bg')
  expect(board).toEqual({ bg: '#1e3a5f', pattern: 'grid', messy: true })
  expect(elements[2]).toMatchObject({ deco: 'pin' })
  expect(parseSnapshotText(JSON.stringify({ elements: [] })).board).toEqual({})
})

test('parseSnapshotText keeps image filters only when valid', () => {
  const src = 'data:image/png;base64,AA=='
  const { elements } = parseSnapshotText(
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

test('parseSnapshot (shared snapshots too) drops unparseable links and keeps boxes within limits', () => {
  const link = { type: 'link', title: null, image: null, fonts: [], colors: [], status: 'ok', missing: [] }
  const { elements, colorMeta } = parseSnapshot({
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
  const { elements } = parseSnapshot({
    elements: [{ ...box, type: 'note', text: 'x'.repeat(10_001), x: -1e9, y: 1e9, w: 0.5, h: 1e9 }],
  })
  expect(elements[0]).toMatchObject({ x: -1e6, y: 1e6, w: 1, h: 10_000 })
  expect((elements[0] as { text: string }).text).toHaveLength(10_000)
})

test('a link still loading comes back as an interrupted error', () => {
  const { elements } = parseSnapshot({
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
  await openSnapshot(parseSnapshot(JSON.parse(JSON.stringify(sample))), 'replace')
  expect(same()).toEqual(expected)
  expect(useBoard.getState().past).toHaveLength(1)
})

test('open new: round-trips as another board with a clean history', async () => {
  reset()
  useBoard.setState({ selectedIds: ['x'], past: [{} as never] })
  await openSnapshot(parseSnapshot(sample), 'new')
  const s = useBoard.getState()
  expect(same()).toEqual(expected)
  expect(s.boards).toHaveLength(2)
  expect(s.boardId).toBe(s.boards[1].id)
  expect([s.past, s.selectedIds]).toEqual([[], []])
})

test('open readonly: round-trips with a clean history and keeps the board id', async () => {
  reset()
  useBoard.setState({ past: [{} as never] })
  await openSnapshot(parseSnapshot(sample), 'readonly')
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
  const { elements } = parseSnapshotText(file)
  expect(elements[0]).toMatchObject({ locked: true, flipX: true, crop: { x: 0.5, y: 0, w: 0.5, h: 0.5 } })
  expect(elements[0]).not.toHaveProperty('flipY')
  for (const k of ['locked', 'crop']) expect(elements[1]).not.toHaveProperty(k)
  expect(elements[2]).toMatchObject({ locked: true })
  const again = parseSnapshotText(JSON.stringify({ elements }))
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
  const { elements, skipped } = parseSnapshotText(file)
  expect(skipped).toBe(1)
  expect(elements[0]).toMatchObject({ type: 'frame', title: 'Moods', groupId: 'g1' })
  expect(elements[1]).toMatchObject({ heading: true, groupId: 'g1' })
  for (const k of ['heading', 'groupId']) expect(elements[2]).not.toHaveProperty(k)
  const again = parseSnapshotText(JSON.stringify({ elements }))
  expect(again.elements.map(({ id, ...e }) => e)).toEqual(elements.map(({ id, ...e }) => e))
})
