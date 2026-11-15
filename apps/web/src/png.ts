import { boundsOf } from './geometry.ts'
import { useBoard, type BoardElement } from './store.ts'

const PAD = 48
const RADIUS = 25 // rounded-2xl with the theme radius
const MAX_SIDE = 8000 // browsers refuse much larger canvases

/** Greedy word wrap; `measure` returns a string's width. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word
      if (line && measure(next) > maxWidth) {
        lines.push(line)
        line = word
      } else line = next
    }
    lines.push(line)
  }
  return lines
}

function loadImage(src: string) {
  // onload, not decode(): decode() can stall while the tab is in the background
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Draws img to fill the rect like CSS object-fit: cover. */
function cover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h)
}

function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const all = wrapText(text, maxW, (s) => ctx.measureText(s).width)
  const shown = all.slice(0, maxLines)
  if (all.length > maxLines) shown[maxLines - 1] += '…'
  shown.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
}

/** Renders the whole board (not just the viewport) to a PNG with the current theme. Selection and handles are left out. */
export async function boardPng(elements: BoardElement[], scale = 2): Promise<Blob> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  const theme = { bg: v('--background'), card: v('--card'), fg: v('--card-foreground'), muted: v('--muted-foreground'), border: v('--border') }
  const sans = v('--font-sans')
  const serif = v('--font-heading')
  await document.fonts.ready

  const b = boundsOf(elements)
  const k = Math.min(scale, MAX_SIDE / (b.w + PAD * 2), MAX_SIDE / (b.h + PAD * 2))
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil((b.w + PAD * 2) * k)
  canvas.height = Math.ceil((b.h + PAD * 2) * k)
  const ctx = canvas.getContext('2d')!
  ctx.scale(k, k)
  ctx.fillStyle = theme.bg
  ctx.fillRect(0, 0, b.w + PAD * 2, b.h + PAD * 2)
  ctx.translate(PAD - b.x, PAD - b.y)

  const images = new Map<string, HTMLImageElement>()
  await Promise.all(
    elements.flatMap((el) => {
      const src = el.type === 'image' ? el.src : el.type === 'link' ? el.image : null
      return src ? [loadImage(src).then((img) => void images.set(el.id, img), () => {})] : []
    }),
  )

  for (const el of elements) {
    const { w, h } = el
    ctx.save()
    ctx.translate(el.x + w / 2, el.y + h / 2)
    ctx.rotate((el.rotation * Math.PI) / 180)
    ctx.translate(-w / 2, -h / 2)

    // soft shadow, then clip to the rounded card
    ctx.save()
    ctx.shadowColor = 'rgb(0 0 0 / 0.08)'
    ctx.shadowBlur = 24
    ctx.shadowOffsetY = 6
    ctx.fillStyle = el.type === 'color' ? el.hex : theme.card
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, RADIUS)
    ctx.fill()
    ctx.restore()
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, RADIUS)
    ctx.clip()
    ctx.textBaseline = 'top'
    const img = images.get(el.id)

    if (el.type === 'image' && img) cover(ctx, img, 0, 0, w, h)

    if (el.type === 'note') {
      ctx.fillStyle = theme.fg
      ctx.font = `15px ${sans}`
      lines(ctx, el.text, 16, 16, w - 32, 24, Math.floor((h - 32) / 24))
    }

    if (el.type === 'color') {
      ctx.font = `12px ui-monospace, monospace`
      const tw = ctx.measureText(el.hex).width + 16
      ctx.fillStyle = theme.card
      ctx.beginPath()
      ctx.roundRect(8, h - 30, tw, 22, 11)
      ctx.fill()
      ctx.fillStyle = theme.fg
      ctx.fillText(el.hex, 16, h - 25)
    }

    if (el.type === 'link') {
      const textH = Math.min(h, 110)
      if (img) cover(ctx, img, 0, 0, w, h - textH)
      const top = img ? h - textH + 16 : 16
      ctx.fillStyle = theme.muted
      ctx.font = `12px ${sans}`
      ctx.fillText(new URL(el.url).hostname.replace(/^www\./, ''), 16, top)
      ctx.fillStyle = theme.fg
      ctx.font = `18px ${serif}`
      lines(ctx, el.title ?? el.url, 16, top + 22, w - 32, 24, 2)
      el.colors.forEach((hex, i) => {
        ctx.fillStyle = hex
        ctx.beginPath()
        ctx.arc(24 + i * 22, h - 20, 8, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    ctx.restore()
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png'))
}

export async function downloadPng() {
  const { elements, notify } = useBoard.getState()
  if (!elements.length) return
  try {
    const url = URL.createObjectURL(await boardPng(elements))
    const a = document.createElement('a')
    a.href = url
    a.download = 'lino-board.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    notify((e as Error).message)
  }
}
