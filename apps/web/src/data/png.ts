import type { Crop } from '../board/crop.ts'
import { boundsOf } from '../board/geometry.ts'
import { resolveImage } from './images.ts'
import { useBoard, type BoardElement } from '../board/store.ts'
import { CARD_PAD, LINK_DOT, LINK_DOT_CENTER_FROM_BOTTOM, LINK_DOT_GAP, LINK_TEXT_MAX_H, PIN, TAPE, isBare, noteInk } from '../kinds/look.ts'
import { FAMILY, RADIUS, noteText, filterPixels, loadFamily, textOn, type BoardStyle, type Deco, type ImageStyle } from '../board/style.ts'

const PAD = 48
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

async function loadImage(source: string) {
  const src = await resolveImage(source)
  // onload, not decode(): decode() can stall while the tab is in the background
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

type Source = HTMLImageElement | HTMLCanvasElement
const dims = (img: Source) => (img instanceof HTMLImageElement ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height])

/** Draws img to fill the rect like CSS object-fit: cover, or just the `crop` part of it stretched to the rect. */
function cover(ctx: CanvasRenderingContext2D, img: Source, x: number, y: number, w: number, h: number, crop?: Crop) {
  const [iw, ih] = dims(img)
  if (crop) return ctx.drawImage(img, crop.x * iw, crop.y * ih, crop.w * iw, crop.h * ih, x, y, w, h)
  const s = Math.max(w / iw, h / ih)
  const sw = w / s
  const sh = h / s
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h)
}

/** The image with its mono/duotone filter baked in, or the image itself. */
function filtered(img: HTMLImageElement, s: ImageStyle): Source {
  if (!s.filter) return img
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  filterPixels(data.data, s.filter, s.duo)
  ctx.putImageData(data, 0, 0)
  return c
}

function lines(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number, align: CanvasTextAlign = 'left') {
  ctx.textAlign = align
  const ax = align === 'center' ? x + maxW / 2 : align === 'right' ? x + maxW : x
  const all = wrapText(text, maxW, (s) => ctx.measureText(s).width)
  const shown = all.slice(0, maxLines)
  if (all.length > maxLines) shown[maxLines - 1] += '…'
  shown.forEach((l, i) => ctx.fillText(l, ax, y + i * lineH))
  ctx.textAlign = 'left'
}

/** Tape across the top edge or a pin near it, matching the board view. */
function drawDeco(ctx: CanvasRenderingContext2D, deco: Deco | undefined, w: number) {
  if (!deco) return
  ctx.save()
  ctx.shadowColor = 'rgb(0 0 0 / 0.2)'
  ctx.shadowBlur = 3
  ctx.shadowOffsetY = 1
  if (deco === 'tape') {
    ctx.translate(w / 2, 0)
    ctx.rotate((TAPE.tiltDeg * Math.PI) / 180)
    ctx.fillStyle = TAPE.color
    ctx.fillRect(-TAPE.w / 2, -TAPE.h / 2, TAPE.w, TAPE.h)
  } else {
    ctx.fillStyle = PIN.color
    ctx.beginPath()
    ctx.arc(w / 2, PIN.top + PIN.size / 2, PIN.size / 2, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

type Of<T extends BoardElement['type']> = Extract<BoardElement, { type: T }>

/** Everything drawing needs besides the element: the canvas, the theme colours and fonts, and the board's ink. */
type Paint = {
  ctx: CanvasRenderingContext2D
  theme: { card: string; fg: string; muted: string }
  sans: string
  serif: string
  /** frames and headings are drawn in the board's ink, not on a card */
  ink: string
}

const FRAME_FILL_ALPHA = 0.06
const FRAME_STROKE_ALPHA = 0.25
const CARD_SHADOW = { color: 'rgb(0 0 0 / 0.08)', blur: 24, offsetY: 6 }
/** The hex label pill at the bottom left of a colour swatch. */
const HEX_PILL = { left: 8, fromBottom: 30, h: 22, padX: 8 }

/** Google Fonts used by notes must be loaded before they are drawn on the canvas. */
async function loadNoteFonts(elements: BoardElement[]) {
  const families = [...new Set(elements.flatMap((e) => (e.type === 'note' && e.family && FAMILY.test(e.family) ? [e.family] : [])))]
  families.forEach(loadFamily)
  await Promise.all(families.map((f) => document.fonts.load(`16px "${f}"`).catch(() => [])))
  await document.fonts.ready
}

/** The pictures of image and link cards by element id; ones that fail to load are left out. */
async function loadPictures(elements: BoardElement[]) {
  const images = new Map<string, HTMLImageElement>()
  await Promise.all(
    elements.flatMap((el) => {
      const src = el.type === 'image' ? el.src : el.type === 'link' ? el.image : null
      return src ? [loadImage(src).then((img) => void images.set(el.id, img), () => {})] : []
    }),
  )
  return images
}

function drawFrame({ ctx, sans, ink }: Paint, el: Of<'frame'>, radius: number) {
  const opacity = el.opacity ?? 1
  ctx.fillStyle = ink
  ctx.strokeStyle = ink
  ctx.beginPath()
  ctx.roundRect(0, 0, el.w, el.h, radius)
  ctx.globalAlpha *= FRAME_FILL_ALPHA
  ctx.fill()
  ctx.globalAlpha = opacity * FRAME_STROKE_ALPHA
  ctx.stroke()
  ctx.globalAlpha = opacity
  ctx.font = `500 14px ${sans}`
  ctx.textBaseline = 'bottom'
  ctx.fillText(el.title, 4, -6)
}

/** The card itself with its soft shadow; bare headings have none. */
function drawCardBack({ ctx, theme }: Paint, el: BoardElement, radius: number) {
  if (isBare(el)) return
  ctx.save()
  if (el.shadow !== false) {
    ctx.shadowColor = CARD_SHADOW.color
    ctx.shadowBlur = CARD_SHADOW.blur
    ctx.shadowOffsetY = CARD_SHADOW.offsetY
  }
  ctx.fillStyle = el.type === 'color' ? el.hex : ((el.type === 'note' ? el.bg : undefined) ?? theme.card)
  ctx.beginPath()
  ctx.roundRect(0, 0, el.w, el.h, radius)
  ctx.fill()
  ctx.restore()
}

function drawPicture({ ctx }: Paint, el: Of<'image'>, img: HTMLImageElement) {
  // flips mirror the cropped picture about the box centre, like the CSS transform on screen
  ctx.translate(el.flipX ? el.w : 0, el.flipY ? el.h : 0)
  ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1)
  cover(ctx, filtered(img, el), 0, 0, el.w, el.h, el.crop)
}

function drawNote({ ctx, theme, sans, serif, ink }: Paint, el: Of<'note'>) {
  const [size, lineH] = noteText(el)
  const base = el.font === 'serif' ? serif : sans
  const family = el.family && FAMILY.test(el.family) ? `"${el.family}", ${base}` : base
  ctx.fillStyle = noteInk(el, ink) ?? theme.fg
  ctx.font = `${el.italic ? 'italic ' : ''}${el.bold ? '700 ' : ''}${size}px ${family}`
  const maxLines = Math.floor((el.h - CARD_PAD * 2) / lineH)
  lines(ctx, el.text, CARD_PAD, CARD_PAD + (lineH - size) / 2, el.w - CARD_PAD * 2, lineH, maxLines, el.align)
}

function drawSwatchLabel({ ctx, theme }: Paint, el: Of<'color'>) {
  ctx.font = `12px ui-monospace, monospace`
  const top = el.h - HEX_PILL.fromBottom
  ctx.fillStyle = theme.card
  ctx.beginPath()
  ctx.roundRect(HEX_PILL.left, top, ctx.measureText(el.hex).width + HEX_PILL.padX * 2, HEX_PILL.h, HEX_PILL.h / 2)
  ctx.fill()
  ctx.fillStyle = theme.fg
  ctx.fillText(el.hex, HEX_PILL.left + HEX_PILL.padX, top + 5)
}

function drawLink({ ctx, theme, sans, serif }: Paint, el: Of<'link'>, img: HTMLImageElement | undefined) {
  const { w, h } = el
  const textH = Math.min(h, LINK_TEXT_MAX_H)
  if (img) cover(ctx, img, 0, 0, w, h - textH)
  const top = img ? h - textH + CARD_PAD : CARD_PAD
  ctx.fillStyle = theme.muted
  ctx.font = `12px ${sans}`
  ctx.fillText(new URL(el.url).hostname.replace(/^www\./, ''), 16, top)
  ctx.fillStyle = theme.fg
  ctx.font = `18px ${serif}`
  lines(ctx, el.title ?? el.url, CARD_PAD, top + 22, w - CARD_PAD * 2, 24, 2)
  el.colors.forEach((hex, i) => {
    ctx.fillStyle = hex
    ctx.beginPath()
    ctx.arc(CARD_PAD + LINK_DOT / 2 + i * (LINK_DOT + LINK_DOT_GAP), h - LINK_DOT_CENTER_FROM_BOTTOM, LINK_DOT / 2, 0, Math.PI * 2)
    ctx.fill()
  })
}

/** A card: its back, then its content clipped to the rounded shape, then its tape or pin over the edge. */
function drawCard(p: Paint, el: BoardElement, radius: number, img: HTMLImageElement | undefined) {
  const { ctx } = p
  drawCardBack(p, el, radius)
  ctx.save()
  ctx.beginPath()
  ctx.roundRect(0, 0, el.w, el.h, radius)
  ctx.clip()
  ctx.textBaseline = 'top'
  if (el.type === 'image' && img) drawPicture(p, el, img)
  if (el.type === 'note') drawNote(p, el)
  if (el.type === 'color') drawSwatchLabel(p, el)
  if (el.type === 'link') drawLink(p, el, img)
  ctx.restore()
  drawDeco(ctx, el.deco, el.w)
}

/** Renders the whole board (not just the viewport) to a PNG with the current theme. Selection and handles are left out. */
export async function boardPng(elements: BoardElement[], scale = 2, board: BoardStyle = {}): Promise<Blob> {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  await loadNoteFonts(elements)

  const b = boundsOf(elements)
  const width = b.w + PAD * 2
  const height = b.h + PAD * 2
  const k = Math.min(scale, MAX_SIDE / width, MAX_SIDE / height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * k)
  canvas.height = Math.ceil(height * k)
  const ctx = canvas.getContext('2d')!
  ctx.scale(k, k)
  ctx.fillStyle = board.bg ?? v('--background')
  ctx.fillRect(0, 0, width, height)
  ctx.translate(PAD - b.x, PAD - b.y)

  const images = await loadPictures(elements)
  const paint: Paint = {
    ctx,
    theme: { card: v('--card'), fg: v('--card-foreground'), muted: v('--muted-foreground') },
    sans: v('--font-sans'),
    serif: v('--font-heading'),
    ink: (board.bg && textOn(board.bg)) || v('--foreground'),
  }
  // frames first: they sit behind everything else
  for (const el of [...elements.filter((e) => e.type === 'frame'), ...elements.filter((e) => e.type !== 'frame')]) {
    ctx.save()
    ctx.translate(el.x + el.w / 2, el.y + el.h / 2)
    ctx.rotate((el.rotation * Math.PI) / 180)
    ctx.translate(-el.w / 2, -el.h / 2)
    ctx.globalAlpha = el.opacity ?? 1
    const radius = Math.min(RADIUS[el.corner ?? 'soft'], el.w / 2, el.h / 2)
    if (el.type === 'frame') drawFrame(paint, el, radius)
    else drawCard(paint, el, radius, images.get(el.id))
    ctx.restore()
  }

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image.'))), 'image/png'))
}

export async function downloadPng() {
  const { elements, board, notify } = useBoard.getState()
  if (!elements.length) return
  try {
    const url = URL.createObjectURL(await boardPng(elements, 2, board))
    const a = document.createElement('a')
    a.href = url
    a.download = 'lino-board.png'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (e) {
    notify((e as Error).message)
  }
}
