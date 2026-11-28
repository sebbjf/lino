import { normalizeHex } from '../palette/colors.ts'
import { asUrl } from './link.ts'

type PasteAction =
  | { type: 'images'; files: File[] }
  | { type: 'color'; hex: string }
  | { type: 'link'; url: string }
  | { type: 'note'; text: string }

/** Reads clipboard contents in the order the board handles them. */
export function pasteAction(text: string | undefined, files: Iterable<File>): PasteAction | null {
  const images = [...files].filter((file) => file.type.startsWith('image/'))
  if (images.length) return { type: 'images', files: images }
  const trimmed = text?.trim()
  if (!trimmed) return null
  const hex = normalizeHex(trimmed)
  if (hex) return { type: 'color', hex }
  const url = asUrl(trimmed)
  if (url) return { type: 'link', url }
  return { type: 'note', text: trimmed }
}
