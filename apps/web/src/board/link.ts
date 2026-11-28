import { readImage } from '../data/image.ts'
import { toId } from '../data/images.ts'
import { ConnectionNeeded, fetchApi } from '../data/apiConnection.ts'
import { useBoard, type LinkInfo } from './store.ts'

const API = import.meta.env.VITE_API_URL ?? '/api'
const W = 280

/** A single http(s) URL, the kind of paste that should become a link card. */
export function asUrl(text: string): string | null {
  if (!/^https?:\/\/\S+$/i.test(text)) return null
  try {
    return new URL(text).href
  } catch {
    return null
  }
}

/** The URL a bookmarklet handed over in `?add=`, if it is a plain http(s) URL. */
export function sharedUrl(search: string): string | null {
  const v = new URLSearchParams(search).get('add')
  return v ? asUrl(v) : null
}

/** Whether a URL's path ends in an image extension. */
export const isImageUrl = (url: string) => /\.(png|jpe?g|webp|gif|avif)$/i.test(new URL(url).pathname)

/** The `javascript:` link to drag to the bookmarks bar: opens the current page in the user's Lino board. */
export const bookmarklet = (origin: string) =>
  `javascript:void(window.open('${origin}/board/?add='+encodeURIComponent(location.href),'_blank'))`

/** Adds a loading link card at once, then fills it with what the API could read. The card stays if reading fails. */
export async function addLink(url: string, at?: { x: number; y: number }) {
  const { add, update, notify } = useBoard.getState()
  const pending: LinkInfo = { url, title: null, image: null, fonts: [], colors: [], status: 'loading', missing: [] }
  const id = add({ type: 'link', ...pending, w: W, h: 120 }, at)

  try {
    const res = await fetchApi(`${API}/read?url=${encodeURIComponent(url)}`, 'Offline: the link was added without a preview.')
    const data = await res.json().catch(() => ({ error: 'The link reader is not available.' }))
    if (!res.ok) throw new Error(data.error ?? 'Could not read that page.')

    let image: string | null = null
    let h = 140
    let cover: string[] = []
    if (data.image) {
      try {
        const blob = await (await fetch(data.image)).blob()
        const img = await readImage(new File([blob], 'cover', { type: blob.type }))
        image = await toId(img.src).catch(() => img.src)
        h = 140 + Math.min(200, Math.round((W * img.h) / img.w))
        cover = img.colors
      } catch {
        // an unreadable cover is the same as no cover
      }
    }
    const colors = [...new Set([...data.colors, ...cover])].slice(0, 8)
    const missing = (data.missing as string[]).filter((m) => m !== 'colors' || !colors.length)
    if (!image && !missing.includes('image')) missing.push('image')
    update(id, { url: data.url, title: data.title, image, fonts: data.fonts, colors, missing, status: 'ok', h })
  } catch (e) {
    if (e instanceof ConnectionNeeded) {
      update(id, { status: 'ok' })
      notify(e.message)
      return
    }
    const msg = e instanceof TypeError ? 'The link reader is not available.' : (e as Error).message
    update(id, { status: 'error', error: msg })
  }
}
