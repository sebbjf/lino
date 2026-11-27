import { arrowDelta } from './commands.ts'
import type { Layer } from './store.ts'

/** Arrow-key distance in board px, with and without Shift. */
const NUDGE = 1
const NUDGE_BIG = 10

export type Keys = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>

/** What a key pressed on a focused board element asks for. */
export type ElementKey =
  | { do: 'nudge' | 'resize'; dx: number; dy: number }
  | { do: 'rotate'; dir: 1 | -1 }
  | { do: 'reorder'; to: Layer }
  | { do: 'copy-style' | 'paste-style' | 'frame' | 'group' | 'ungroup' | 'remove' | 'duplicate' | 'open' | 'escape' }

/** Reads a key press on a focused element as one action, or null when the element does not handle it. */
export function elementKey(e: Keys): ElementKey | null {
  const mod = e.metaKey || e.ctrlKey
  const arrow = arrowDelta(e.key, e.shiftKey ? NUDGE_BIG : NUDGE)
  // Alt+arrows resize from the bottom-right corner, the keyboard twin of the resize handle
  if (arrow) return { do: e.altKey ? 'resize' : 'nudge', dx: arrow[0], dy: arrow[1] }
  // by key position: Alt changes e.key on some layouts
  if (mod && e.altKey && e.code === 'KeyC') return { do: 'copy-style' }
  if (mod && e.altKey && e.code === 'KeyV') return { do: 'paste-style' }
  if (mod && e.altKey && e.code === 'KeyF') return { do: 'frame' }
  switch (e.key) {
    case 'g':
    case 'G':
      return mod ? { do: e.shiftKey ? 'ungroup' : 'group' } : null
    case 'd':
      return mod ? { do: 'duplicate' } : null
    case 'r':
    case 'R':
      // Ctrl+R stays reload
      return mod ? null : { do: 'rotate', dir: e.shiftKey ? -1 : 1 }
    case ']':
      return { do: 'reorder', to: mod ? 'front' : 'forward' }
    case '[':
      return { do: 'reorder', to: mod ? 'back' : 'backward' }
    case 'Delete':
    case 'Backspace':
      return { do: 'remove' }
    case 'Enter':
      return { do: 'open' }
    case 'Escape':
      return { do: 'escape' }
    default:
      return null
  }
}
