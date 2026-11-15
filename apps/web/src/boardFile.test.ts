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
