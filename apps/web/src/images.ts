import type { BoardElement } from './store.ts'
import type { Snapshot } from './snapshot.ts'

// Images of a local board live apart from its record, as blobs keyed by the hash of their bytes (ADR 0002).
// A Board snapshot stays self-contained: `externalize` turns its data URLs into ids when it enters local
// storage, `inline` turns ids back into data URLs before it leaves (board file, share).

export type BlobStore = {
  get(id: string): Promise<Blob | undefined>
  put(id: string, blob: Blob): Promise<void>
  ids(): Promise<string[]>
  delete(id: string): Promise<void>
}

let store: BlobStore | undefined
/** Which store holds the blobs: IndexedDB in the app (see db.ts), a Map in tests. */
export const setBlobStore = (s: BlobStore) => void (store = s)
const blobs = () => {
  if (!store) throw new Error('No image store.')
  return store
}

export const IMAGE_ID = /^img:[0-9a-f]{64}$/
export const isImageId = (s: unknown): s is string => typeof s === 'string' && IMAGE_ID.test(s)
const isDataUrl = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:')

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Stores the picture behind a data URL and returns its id. The same bytes always give the same id. */
export async function toId(dataUrl: string) {
  const blob = await (await fetch(dataUrl)).blob()
  const id = `img:${hex(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))}`
  await blobs().put(id, blob)
  return id
}

async function toDataUrl(id: string) {
  const blob = await blobs().get(id)
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type};base64,${btoa(bin)}`
}

/** Applies `fn` to the picture of every image and link element; returns the same snapshot when nothing changed. */
async function mapPictures(snap: Snapshot, fn: (s: string) => Promise<string | null> | null, test: (s: unknown) => boolean): Promise<Snapshot> {
  let changed = false
  const elements = (
    await Promise.all(
      snap.elements.map(async (e): Promise<BoardElement | null> => {
        if (e.type === 'image' && test(e.src)) {
          const src = await fn(e.src)
          changed = true
          return src ? { ...e, src } : null // an image without its picture is not worth keeping
        }
        if (e.type === 'link' && test(e.image)) {
          changed = true
          return { ...e, image: await fn(e.image!) }
        }
        return e
      }),
    )
  ).filter((e) => e !== null)
  return changed ? { ...snap, elements } : snap
}

/** Moves the pictures of a snapshot into the blob store, leaving ids. */
export const externalize = (snap: Snapshot) => mapPictures(snap, toId, isDataUrl)

/** Reads the pictures back as data URLs. Elements whose blob is missing lose their picture. */
export const inline = (snap: Snapshot) => mapPictures(snap, toDataUrl, isImageId)

/** Deletes every blob that is not in `used`. Only safe to run when no undo history can bring one back (app start). */
export async function sweepImages(used: Set<string>) {
  const s = blobs()
  await Promise.all((await s.ids()).filter((id) => !used.has(id)).map((id) => s.delete(id)))
}
