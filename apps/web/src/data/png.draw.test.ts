import { afterEach, expect, test, vi } from 'vitest'
import type { BoardElement } from '../board/store.ts'
import { boardPng } from './png.ts'

// Records every canvas call and property set, so the drawing of a whole board can be pinned exactly.
function recordingCanvas(log: string[]) {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (_, key: string) =>
      key === 'measureText' ? (s: string) => ({ width: s.length * 7 }) : (...args: unknown[]) => void log.push(`${key}(${args.map((a) => (typeof a === 'object' ? 'img' : JSON.stringify(a))).join(',')})`),
    set: (_, key: string, value) => (log.push(`${key}=${JSON.stringify(value)}`), true),
  })
  return { width: 0, height: 0, getContext: () => ctx, toBlob: (cb: (b: unknown) => void) => cb({ type: 'image/png' }) }
}

class FakeImage {
  naturalWidth = 200
  naturalHeight = 100
  onload: () => void = () => {}
  onerror: () => void = () => {}
  set src(v: string) {
    setTimeout(() => (v.includes('broken') ? this.onerror() : this.onload()))
  }
}

afterEach(() => vi.unstubAllGlobals())

test('boardPng draws every element kind the same way', async () => {
  const log: string[] = []
  const canvas = recordingCanvas(log)
  vi.stubGlobal('document', {
    documentElement: {},
    head: { append: () => {} },
    fonts: { load: async () => [], ready: Promise.resolve() },
    createElement: (tag: string) => (tag === 'canvas' ? canvas : {}),
  })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (name: string) => `[${name}]` }))
  vi.stubGlobal('Image', FakeImage)
  vi.stubGlobal('HTMLImageElement', FakeImage)

  const base = { rotation: 0, w: 200, h: 120 }
  const elements: BoardElement[] = [
    { ...base, id: 'n1', type: 'note', x: 0, y: 0, text: 'Hello there, a note that wraps over lines', bold: true, italic: true, family: 'Inter', align: 'center', deco: 'tape' },
    { ...base, id: 'h1', type: 'note', x: 0, y: 150, text: 'Heading', heading: true, font: 'serif', corner: 'square' },
    { ...base, id: 'f1', type: 'frame', x: -40, y: -60, w: 600, h: 500, title: 'Frame', opacity: 0.5 },
    { ...base, id: 'c1', type: 'color', x: 260, y: 0, hex: '#336699', shadow: false, deco: 'pin' },
    { ...base, id: 'i1', type: 'image', x: 260, y: 150, rotation: 15, src: 'https://x/a.png', flipX: true, crop: { x: 0.1, y: 0.1, w: 0.5, h: 0.5 } },
    { ...base, id: 'i2', type: 'image', x: 480, y: 150, src: 'https://x/broken.png' },
    { ...base, id: 'l1', type: 'link', x: 0, y: 300, h: 260, url: 'https://www.example.com/page', title: null, image: 'https://x/l.png', fonts: [], colors: ['#111111', '#eeeeee'], status: 'ok', missing: [] },
  ]
  await boardPng(elements, 2, { bg: '#fafafa' })
  expect([`${canvas.width}x${canvas.height}`, ...log]).toMatchSnapshot()
})
