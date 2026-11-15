import { fitView } from './geometry.ts'
import type { ColorMeta } from './colors.ts'
import { useBoard, type BoardElement } from './store.ts'

const API = import.meta.env.VITE_API_URL ?? '/api'

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, init).catch(() => {
    throw new Error('Sharing is not available right now.')
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Sharing is not available right now.')
  return data
}

/** Uploads a fixed copy of the board and returns its read-only link. */
export async function shareBoard(): Promise<{ url: string; expiresAt: string }> {
  const { elements, colorMeta } = useBoard.getState()
  // a link still reading would never finish on the shared copy
  const done = elements.map((e) => (e.type === 'link' && e.status === 'loading' ? { ...e, status: 'error' as const, error: 'Not read yet.' } : e))
  const { id, expiresAt } = await call('/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ elements: done, colorMeta }),
  })
  return { url: `${location.origin}/board/?s=${id}`, expiresAt }
}

/** Opens a shared board read-only, fitted to the window. */
export async function loadShared(id: string) {
  const { elements, colorMeta = {} } = (await call(`/boards/${encodeURIComponent(id)}`)) as {
    elements: BoardElement[]
    colorMeta?: Record<string, ColorMeta>
  }
  useBoard.setState({ elements, colorMeta, readOnly: true, view: fitView(elements, innerWidth, innerHeight) })
}

export const sharedId = () => new URLSearchParams(location.search).get('s')
