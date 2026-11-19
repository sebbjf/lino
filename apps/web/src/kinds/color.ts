import { isHexStr, normalizeHex } from './check.ts'
import type { Kind } from './types.ts'

export const color: Kind<'color'> = {
  label: 'Color',
  styleKeys: [],
  colors: (el) => [normalizeHex(el.hex) ?? el.hex],
  parse: (e, box) => (isHexStr(e.hex) ? { ...box, type: 'color', hex: e.hex } : null),
}
