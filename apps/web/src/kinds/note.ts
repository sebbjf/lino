import { FAMILY, NOTE_ALIGNS, NOTE_FONTS, NOTE_SIZES } from '../style.ts'
import { isHexStr, isStr, MAX_TEXT, oneOf } from './check.ts'
import type { Kind } from './types.ts'

export const note: Kind<'note'> = {
  label: 'Note',
  styleKeys: ['bg', 'color', 'size', 'font', 'family', 'align', 'bold', 'italic', 'heading'],
  colors: () => [],
  parse(e, box) {
    // longer text is cut, not dropped: the share API refuses it and a whole note is worth more than its tail
    if (typeof e.text !== 'string') return null
    return {
      ...box,
      type: 'note',
      text: e.text.slice(0, MAX_TEXT),
      ...(isHexStr(e.bg) && { bg: e.bg }),
      ...(isHexStr(e.color) && { color: e.color }),
      ...(oneOf(NOTE_SIZES, e.size) && { size: e.size }),
      ...(oneOf(NOTE_ALIGNS, e.align) && { align: e.align }),
      ...(typeof e.bold === 'boolean' && { bold: e.bold }),
      ...(typeof e.italic === 'boolean' && { italic: e.italic }),
      ...(typeof e.heading === 'boolean' && { heading: e.heading }),
      ...(oneOf(NOTE_FONTS, e.font) && { font: e.font }),
      ...(isStr(e.family, 60) && FAMILY.test(e.family) && { family: e.family }),
    }
  },
}
