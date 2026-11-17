import { beforeEach, expect, test } from 'vitest'
import { externalize, inline, isImageId, setBlobStore, sweepImages, type BlobStore } from './images.ts'
import type { Snapshot } from './snapshot.ts'

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const box = { x: 0, y: 0, w: 10, h: 10, rotation: 0 }
const image = (id: string, src: string) => ({ ...box, id, type: 'image' as const, src })
const link = (id: string, img: string | null) => ({ ...box, id, type: 'link' as const, url: 'https://a.test/', title: null, image: img, fonts: [], colors: [], status: 'ok' as const, missing: [] })
const snap = (...elements: Snapshot['elements']): Snapshot => ({ elements, colorMeta: {}, board: {} })

let blobs: Map<string, Blob>
beforeEach(() => {
  blobs = new Map()
  const store: BlobStore = {
    get: async (id) => blobs.get(id),
    put: async (id, blob) => void blobs.set(id, blob),
    ids: async () => [...blobs.keys()],
    delete: async (id) => void blobs.delete(id),
  }
  setBlobStore(store)
})

test('externalize then inline gives the same snapshot back, for images and link covers', async () => {
  const before = snap(image('a', PNG), link('b', GIF), link('c', null))
  const out = await externalize(before)
  expect(out.elements.map((e) => (e.type === 'image' ? e.src : e.type === 'link' ? e.image : ''))).toEqual([expect.stringMatching(/^img:/), expect.stringMatching(/^img:/), null])
  expect(blobs.size).toBe(2)
  expect(await inline(out)).toEqual(before)
})

test('the same picture is stored once, and an already external snapshot is returned as is', async () => {
  const out = await externalize(snap(image('a', PNG), image('b', PNG)))
  expect(blobs.size).toBe(1)
  expect(isImageId((out.elements[0] as { src: string }).src)).toBe(true)
  expect(await externalize(out)).toBe(out)
})

test('inline drops what has no blob instead of leaving a dead id', async () => {
  const out = await externalize(snap(image('a', PNG), link('b', GIF)))
  blobs.clear()
  const back = await inline(out)
  expect(back.elements.map((e) => e.type)).toEqual(['link'])
  expect(back.elements[0]).toMatchObject({ image: null })
})

test('sweep deletes only the blobs no board references', async () => {
  const out = await externalize(snap(image('a', PNG), image('b', GIF)))
  const keep = (out.elements[0] as { src: string }).src
  await sweepImages(new Set([keep]))
  expect([...blobs.keys()]).toEqual([keep])
})
