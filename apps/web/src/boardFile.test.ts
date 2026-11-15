import { expect, test } from 'vitest'
import { parseBoardFile } from './boardFile.ts'

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
