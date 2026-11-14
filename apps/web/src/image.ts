import { useBoard } from './store.ts'

const MAX_BYTES = 20 * 1024 * 1024
const MAX_SIDE = 1600

/** Decodes an image file and downscales it to a WebP data URL (max 1600px on the long side). */
export async function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
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
  // ponytail: images live as data URLs inside the board record; move to Blobs keyed by id if boards get heavy.
  return { src: canvas.toDataURL('image/webp', 0.85), w: canvas.width, h: canvas.height }
}

const MAX_INITIAL_SIDE = 320

/** Reads image files and adds them to the board, cascading from a world point. Failures become notices. */
export async function addImages(files: File[], at?: { x: number; y: number }) {
  const { add, notify } = useBoard.getState()
  for (const [i, file] of files.entries()) {
    try {
      const { src, w, h } = await readImage(file)
      const s = Math.min(1, MAX_INITIAL_SIDE / Math.max(w, h))
      add({ type: 'image', src, w: w * s, h: h * s }, at && { x: at.x + i * 24, y: at.y + i * 24 })
    } catch (e) {
      notify((e as Error).message)
    }
  }
}
