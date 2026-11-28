import { arrowDelta } from './commands.ts'
import { resize, rotateVec } from './geometry.ts'
import { duplicate, frameSelection, group, nudge, remove, reorder, rotateStep, targetOf, ungroup } from './selection.ts'
import { useBoard, type BoardElement, type Layer } from './store.ts'

/** Arrow-key distance in board px, with and without Shift. */
const NUDGE = 1
const NUDGE_BIG = 10

export type Keys = Pick<KeyboardEvent, 'key' | 'code' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'>

type BoardKey =
  | { id: 'fit' | 'delete' | 'clear-selection'; preventDefault: false }
  | { id: 'nudge'; delta: [number, number]; preventDefault: true }
  | { id: 'rotate-ccw' | 'rotate-cw' | 'select-all' | 'duplicate' | 'group' | 'ungroup' | 'frame-selection' | 'undo' | 'redo' | 'save' | 'save-as'; preventDefault: true }

/** Reads a window key press outside text fields as a board action. */
export function boardKey(e: Keys, onBody: boolean, hasSelection: boolean): BoardKey | null {
  const key = e.key.toLowerCase()
  if (!(e.ctrlKey || e.metaKey)) {
    // after Ctrl+A or a selection box nothing has focus; Delete, Escape and the arrows still act on the selection
    if (!onBody) return null
    if (e.key === '1') return { id: 'fit', preventDefault: false }
    if (e.key === 'Delete' || e.key === 'Backspace') return { id: 'delete', preventDefault: false }
    if (e.key === 'Escape') return { id: 'clear-selection', preventDefault: false }
    if (e.altKey || !hasSelection) return null
    const delta = arrowDelta(e.key, e.shiftKey ? NUDGE_BIG : NUDGE)
    if (delta) return { id: 'nudge', delta, preventDefault: true }
    if (key === 'r') return { id: e.shiftKey ? 'rotate-ccw' : 'rotate-cw', preventDefault: true }
    return null
  }

  if (key === 's') return { id: e.shiftKey ? 'save-as' : 'save', preventDefault: true }
  if (key === 'a') return { id: 'select-all', preventDefault: true }
  if (onBody) {
    // a focused element duplicates by itself (ElementView); this covers a selection with no focus
    if (key === 'd') return { id: 'duplicate', preventDefault: true }
    // a focused element handles these itself (ElementView)
    if (key === 'g') return { id: e.shiftKey ? 'ungroup' : 'group', preventDefault: true }
    if (e.altKey && e.code === 'KeyF') return { id: 'frame-selection', preventDefault: true }
  }
  if (key === 'z') return { id: e.shiftKey ? 'redo' : 'undo', preventDefault: true }
  if (key === 'y') return { id: 'redo', preventDefault: true }
  return null
}

/** What a key pressed on a focused board element asks for. */
export type ElementKey =
  | { do: 'nudge' | 'resize'; dx: number; dy: number }
  | { do: 'rotate'; dir: 1 | -1 }
  | { do: 'reorder'; to: Layer }
  | { do: 'copy-style' | 'paste-style' | 'frame' | 'group' | 'ungroup' | 'remove' | 'duplicate' | 'open' | 'escape' }

type Rule = (shift: boolean) => ElementKey
const always = (action: ElementKey): Rule => () => action
const SHARED: Record<string, Rule> = { Delete: always({ do: 'remove' }), Backspace: always({ do: 'remove' }), Enter: always({ do: 'open' }), Escape: always({ do: 'escape' }) }

/** Single keys without Ctrl/Cmd. R rotates 15° clockwise, Shift+R counter-clockwise. */
const PLAIN: Record<string, Rule> = {
  ...SHARED,
  r: (shift) => ({ do: 'rotate', dir: shift ? -1 : 1 }),
  R: (shift) => ({ do: 'rotate', dir: shift ? -1 : 1 }),
  ']': always({ do: 'reorder', to: 'forward' }),
  '[': always({ do: 'reorder', to: 'backward' }),
}

/** Keys with Ctrl/Cmd. Ctrl+R is left to the browser (reload). */
const WITH_MOD: Record<string, Rule> = {
  ...SHARED,
  g: (shift) => ({ do: shift ? 'ungroup' : 'group' }),
  G: (shift) => ({ do: shift ? 'ungroup' : 'group' }),
  d: always({ do: 'duplicate' }),
  ']': always({ do: 'reorder', to: 'front' }),
  '[': always({ do: 'reorder', to: 'back' }),
}

/** Ctrl/Cmd+Alt keys, matched by key position: Alt changes e.key on some layouts. */
const BY_CODE: Record<string, ElementKey> = { KeyC: { do: 'copy-style' }, KeyV: { do: 'paste-style' }, KeyF: { do: 'frame' } }

/** Reads a key press on a focused element as one action, or null when the element does not handle it. */
export function elementKey(e: Keys): ElementKey | null {
  const mod = e.metaKey || e.ctrlKey
  const arrow = arrowDelta(e.key, e.shiftKey ? NUDGE_BIG : NUDGE)
  // Alt+arrows resize from the bottom-right corner, the keyboard twin of the resize handle
  if (arrow) return { do: e.altKey ? 'resize' : 'nudge', dx: arrow[0], dy: arrow[1] }
  const byCode = mod && e.altKey ? BY_CODE[e.code] : undefined
  if (byCode) return byCode
  return (mod ? WITH_MOD : PLAIN)[e.key]?.(e.shiftKey) ?? null
}

/** Runs the board command for a key action that passed the focused element's guards. */
export function runElementKey(action: ElementKey, el: BoardElement): boolean {
  const ids = () => targetOf(el.id)
  switch (action.do) {
    case 'resize': {
      const { checkpoint, update } = useBoard.getState()
      checkpoint()
      const world = rotateVec(action.dx, action.dy, el.rotation)
      update(el.id, resize(el, world.x, world.y, el.type === 'image'))
      break
    }
    case 'nudge':
      nudge(ids(), action.dx, action.dy)
      break
    case 'copy-style':
      useBoard.getState().copyStyle(el.id)
      break
    case 'paste-style':
      useBoard.getState().pasteStyle(ids())
      break
    case 'frame':
      frameSelection(ids())
      break
    case 'group':
      group(ids())
      break
    case 'ungroup':
      ungroup(ids())
      break
    case 'remove':
      remove(ids())
      break
    case 'duplicate':
      duplicate(ids())
      break
    case 'rotate':
      rotateStep(ids(), action.dir)
      break
    case 'reorder':
      reorder(el.id, action.to)
      break
    case 'open':
    case 'escape':
      return false
  }
  return true
}
