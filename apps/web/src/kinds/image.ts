import { clampCrop } from '../crop.ts'
import { IMAGE_FILTERS } from '../style.ts'
import { hexList, isHexStr, isNum, oneOf } from './check.ts'
import type { Kind } from './types.ts'

export const image: Kind<'image'> = {
  label: 'Image',
  styleKeys: ['filter', 'duo', 'flipX', 'flipY'],
  colors: (el) => el.colors ?? [],
  parse(e, box, { isPicture }) {
    if (!isPicture(e.src)) return null
    const duo = Array.isArray(e.duo) && e.duo.length === 2 && e.duo.every(isHexStr) ? (e.duo as [string, string]) : null
    const c = e.crop as Record<string, unknown> | null
    const crop = c && typeof c === 'object' && [c.x, c.y, c.w, c.h].every(isNum) ? clampCrop(c as { x: number; y: number; w: number; h: number }) : null
    return {
      ...box,
      type: 'image',
      src: e.src,
      colors: hexList(e.colors),
      ...(oneOf(IMAGE_FILTERS, e.filter) && { filter: e.filter }),
      ...(duo && { duo }),
      ...(e.flipX === true && { flipX: true }),
      ...(e.flipY === true && { flipY: true }),
      ...(crop && { crop }),
    }
  },
}
