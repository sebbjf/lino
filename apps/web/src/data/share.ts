import { capturePortable, openSnapshot, parseSnapshot, type Snapshot } from './snapshot.ts'
import { ConnectionNeeded, fetchApi, isOffline } from './apiConnection.ts'

const API = import.meta.env.VITE_API_URL ?? '/api'
/** Same as MAX_BOARD_BYTES in apps/api/src/routes.ts. */
const MAX_SHARE_BYTES = 4 * 1024 * 1024
const SHARE_OFFLINE = 'Sharing needs a connection.'

async function call(path: string, offlineMessage: string, init?: RequestInit) {
  // a hung API must not leave the page blank forever
  const res = await fetchApi(`${API}${path}`, offlineMessage, { ...init, signal: AbortSignal.timeout(20_000) }).catch((error: unknown) => {
    if (error instanceof ConnectionNeeded) throw error
    throw new Error('Sharing is not available right now.')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Sharing is not available right now.')
  return data
}

/** The board does not fit as it is; shrinking its images may fix that, but only the user decides. */
export class TooBig extends Error {
  constructor(readonly bytes: number) {
    super('This board is too large to share.')
  }
}

/** Progressively smaller copies of the pictures: longest side in px and WebP quality. */
const LEVELS = [
  { side: 1200, quality: 0.75 },
  { side: 900, quality: 0.65 },
  { side: 640, quality: 0.55 },
]
const size = (snap: Snapshot) => new Blob([JSON.stringify(snap)]).size

/** A smaller copy of one data URL (never upscaled); the original if shrinking would not make it smaller. */
async function shrinkPicture(src: string, { side, quality }: (typeof LEVELS)[number]) {
  const bmp = await createImageBitmap(await (await fetch(src)).blob())
  const scale = Math.min(1, side / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const out = canvas.toDataURL('image/webp', quality)
  return out.length < src.length ? out : src
}

/** The first level whose copy fits in `limit` bytes, or null. The board on screen is never touched. */
export async function fitSnapshot(snap: Snapshot, limit: number, shrink: (src: string, level: (typeof LEVELS)[number]) => Promise<string> = shrinkPicture) {
  const isData = (s: unknown): s is string => typeof s === 'string' && s.startsWith('data:image/')
  for (const level of LEVELS) {
    const elements = await Promise.all(
      snap.elements.map(async (e) => {
        if (e.type === 'image' && isData(e.src)) return { ...e, src: await shrink(e.src, level).catch(() => e.src) }
        if (e.type === 'link' && isData(e.image)) return { ...e, image: await shrink(e.image, level).catch(() => e.image) }
        return e
      }),
    )
    const copy = { ...snap, elements }
    if (size(copy) <= limit) return copy
  }
  return null
}

/**
 * Uploads a fixed copy of the board and returns its read-only link. Too big: throws TooBig, and only with
 * `shrink: true` (the user agreed) are the uploaded copy's images made smaller.
 */
export async function shareBoard(shrink = false): Promise<{ url: string; expiresAt: string }> {
  if (isOffline()) throw new ConnectionNeeded(SHARE_OFFLINE)
  let snap: Snapshot = await capturePortable() // the recipient's parse settles any link still loading
  // the host refuses bigger requests before the API sees them, so say why here
  if (size(snap) > MAX_SHARE_BYTES) {
    if (!shrink) throw new TooBig(size(snap))
    const fit = await fitSnapshot(snap, MAX_SHARE_BYTES)
    if (!fit) throw new Error('This board is too large to share even with smaller images (limit 4 MB). Remove some images.')
    snap = fit
  }
  const { id, expiresAt } = await call('/boards', SHARE_OFFLINE, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(snap) })
  return { url: `${location.origin}/board/?s=${id}`, expiresAt }
}

/** Opens a shared board read-only, fitted to the window. */
export async function loadShared(id: string) {
  // anyone can post to the API, so the snapshot is rebuilt field by field like an imported file
  await openSnapshot(parseSnapshot(await call(`/boards/${encodeURIComponent(id)}`, 'Opening a shared board needs a connection.')), 'readonly')
}

export const sharedId = () => new URLSearchParams(location.search).get('s')
