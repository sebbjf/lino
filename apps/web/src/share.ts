import { capturePortable, openSnapshot, parseSnapshot } from './snapshot.ts'

const API = import.meta.env.VITE_API_URL ?? '/api'
/** Same as MAX_BOARD_BYTES in apps/api/src/routes.ts. */
const MAX_SHARE_BYTES = 4 * 1024 * 1024

async function call(path: string, init?: RequestInit) {
  // a hung API must not leave the page blank forever
  const res = await fetch(`${API}${path}`, { ...init, signal: AbortSignal.timeout(20_000) }).catch(() => {
    throw new Error('Sharing is not available right now.')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Sharing is not available right now.')
  return data
}

/** Uploads a fixed copy of the board and returns its read-only link. */
export async function shareBoard(): Promise<{ url: string; expiresAt: string }> {
  const body = JSON.stringify(await capturePortable()) // the recipient's parse settles any link still loading
  // the host refuses bigger requests before the API sees them, so say why here
  if (new Blob([body]).size > MAX_SHARE_BYTES) throw new Error('This board is too large to share (limit 4 MB). Remove or shrink some images.')
  const { id, expiresAt } = await call('/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  return { url: `${location.origin}/board/?s=${id}`, expiresAt }
}

/** Opens a shared board read-only, fitted to the window. */
export async function loadShared(id: string) {
  // anyone can post to the API, so the snapshot is rebuilt field by field like an imported file
  await openSnapshot(parseSnapshot(await call(`/boards/${encodeURIComponent(id)}`)), 'readonly')
}

export const sharedId = () => new URLSearchParams(location.search).get('s')
