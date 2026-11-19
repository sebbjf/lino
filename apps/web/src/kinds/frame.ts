import { isStr } from './check.ts'
import type { Kind } from './types.ts'

export const frame: Kind<'frame'> = {
  label: 'Frame',
  styleKeys: [],
  colors: () => [],
  parse: (e, box) => (isStr(e.title, 500) ? { ...box, type: 'frame', title: e.title } : null),
}
