import { readImage } from './image.ts'
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

/** Adds a loading link card at once, then fills it with what the API could read. The card stays if reading fails. */
export async function addLink(url: string, at?: { x: number; y: number }) {
  const { add, update } = useBoard.getState()
  const pending: LinkInfo = { url, title: null, image: null, fonts: [], colors: [], status: 'loading', missing: [] }
  const id = add({ type: 'link', ...pending, w: W, h: 120 }, at)

  try {
    const res = await fetch(`${API}/read?url=${encodeURIComponent(url)}`)
    const data = await res.json().catch(() => ({ error: 'The link reader is not available.' }))
    if (!res.ok) throw new Error(data.error ?? 'Could not read that page.')

    let image: string | null = null
    let h = 140
    let cover: string[] = []
    if (data.image) {
      try {
        const blob = await (await fetch(data.image)).blob()
        const img = await readImage(new File([blob], 'cover', { type: blob.type }))
        image = img.src
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
    const msg = e instanceof TypeError ? 'The link reader is not available.' : (e as Error).message
    update(id, { status: 'error', error: msg })
  }
}
