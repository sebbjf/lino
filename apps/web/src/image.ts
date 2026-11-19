import { dominantColors } from './colors.ts'
import { boundsOf } from './geometry.ts'
import { resolveImage, toId } from './images.ts'
import { useBoard, viewportCenter, type HistoryEntry } from './store.ts'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_SIDE = 1600

/** Main colours of anything drawable, read from a small copy. */
function sample(img: CanvasImageSource, n: number) {
  const ctx = new OffscreenCanvas(32, 32).getContext('2d')!
  ctx.drawImage(img, 0, 0, 32, 32)
  return dominantColors(ctx.getImageData(0, 0, 32, 32).data, n)
}

/** The main colours of an image already on the board. */
export async function imageColors(src: string, n = 5) {
  const bmp = await createImageBitmap(await (await fetch(await resolveImage(src))).blob())
  try {
    return sample(bmp, n)
  } finally {
    bmp.close()
  }
}

/** Decodes an image file and downscales it to a WebP data URL (max 1600px on the long side), with its main colours. */
export async function readImage(file: File): Promise<{ src: string; w: number; h: number; colors: string[] }> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} is not an image.`)
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 20 MB.`)
  const bmp = await createImageBitmap(file).catch(() => {
    throw new Error(`Could not read ${file.name}.`)
  })
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const colors = sample(canvas, 3)
  // ponytail: images live as data URLs inside the board record; move to Blobs keyed by id if boards get heavy.
  return { src: canvas.toDataURL('image/webp', 0.85), w: canvas.width, h: canvas.height, colors }
}

/**
 * Samples the colours of images saved before colours were stored, one at a time, after a board loads.
 * Writes with update(), so it adds no undo step. Read-only boards are left alone.
 */
export async function backfillColors() {
  if (useBoard.getState().readOnly) return
  const ids = useBoard.getState().elements.filter((e) => e.type === 'image' && !e.colors).map((e) => e.id)
  for (const id of ids) {
    const el = useBoard.getState().elements.find((e) => e.id === id)
    if (el?.type !== 'image' || el.colors) continue // gone, or already sampled
    const colors = await imageColors(el.src, 3).catch(() => null) // a failed read is retried next load
    if (!colors) continue
    useBoard.getState().update(id, { colors })
    // not an undo step: write the colours into the history too, so undo/redo never brings back the uncoloured image
    const fill = (h: HistoryEntry): HistoryEntry =>
      h.elements.some((e) => e.id === id && e.type === 'image' && !e.colors)
        ? { ...h, elements: h.elements.map((e) => (e.id === id && e.type === 'image' ? { ...e, colors } : e)) }
        : h
    useBoard.setState((s) => ({ past: s.past.map(fill), future: s.future.map(fill) }))
  }
}

const MAX_INITIAL_SIDE = 320

/**
 * Reads image files and adds them to the board. One lands on the point (or the viewport centre); several
 * land together as a masonry around it, selected, as one undo step. Failures become notices.
 */
export async function addImages(files: File[], at?: { x: number; y: number }) {
  const { notify } = useBoard.getState()
  if (files.length > 1) notify(`Adding ${files.length} images…`)
  const read: Awaited<ReturnType<typeof readImage>>[] = []
  for (const [i, file] of files.entries()) {
    if (files.length > 5) notify(`Reading ${i + 1}/${files.length}…`)
    try {
      const img = await readImage(file)
      read.push({ ...img, src: await toId(img.src).catch(() => img.src) }) // inline if the image store is unavailable
    } catch (e) {
      notify((e as Error).message)
    }
  }
  // everything below is synchronous, so nothing the user does can slip into the middle of the batch
  const { add, arrange, selectMany, step } = useBoard.getState()
  step(() => {
    const ids = read.map(({ src, w, h, colors }, i) => {
      const s = Math.min(1, MAX_INITIAL_SIDE / Math.max(w, h))
      return add({ type: 'image', src, colors, w: w * s, h: h * s }, at && { x: at.x + i * 24, y: at.y + i * 24 })
    })
    if (ids.length < 2) return
    arrange(ids, 'masonry')
    // the masonry grows from where the first image landed: centre the whole group on the target instead
    const { elements: now, view, moveMany } = useBoard.getState()
    const mine = now.filter((e) => ids.includes(e.id))
    const b = boundsOf(mine)
    const c = at ?? viewportCenter(view)
    moveMany(Object.fromEntries(mine.map((e) => [e.id, { x: e.x + c.x - (b.x + b.w / 2), y: e.y + c.y - (b.y + b.h / 2) }])))
    selectMany(ids)
  })
}
