import { dominantColors } from './colors.ts'
import { useBoard } from './store.ts'

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
  const bmp = await createImageBitmap(await (await fetch(src)).blob())
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

const MAX_INITIAL_SIDE = 320

/** Reads image files and adds them to the board, cascading from a world point. Failures become notices. */
export async function addImages(files: File[], at?: { x: number; y: number }) {
  const { add, notify } = useBoard.getState()
  for (const [i, file] of files.entries()) {
    try {
      const { src, w, h, colors } = await readImage(file)
      const s = Math.min(1, MAX_INITIAL_SIDE / Math.max(w, h))
      add({ type: 'image', src, colors, w: w * s, h: h * s }, at && { x: at.x + i * 24, y: at.y + i * 24 })
    } catch (e) {
      notify((e as Error).message)
    }
  }
}
