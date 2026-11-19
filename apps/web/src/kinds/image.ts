import { IMAGE_FILTERS } from '../style.ts'
import { hexList, isHexStr, oneOf } from './check.ts'
import type { Kind } from './types.ts'

export const image: Kind<'image'> = {
  label: 'Image',
  styleKeys: ['filter', 'duo', 'paletteOff'],
  colors: (el) => (el.paletteOff ? [] : (el.colors ?? [])),
  parse(e, box, { isPicture }) {
    if (!isPicture(e.src)) return null
    const duo = Array.isArray(e.duo) && e.duo.length === 2 && e.duo.every(isHexStr) ? (e.duo as [string, string]) : null
    return {
      ...box,
      type: 'image',
      src: e.src,
      // no colors field = saved before colours were stored: storage.ts backfills it; [] means sampled, nothing found
      ...(Array.isArray(e.colors) && { colors: hexList(e.colors) }),
      ...(oneOf(IMAGE_FILTERS, e.filter) && { filter: e.filter }),
      ...(duo && { duo }),
      ...(e.paletteOff === true && { paletteOff: true }),
    }
  },
}
