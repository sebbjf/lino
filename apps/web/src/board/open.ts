import type { BoardElement } from './store.ts'

type OpenAction =
  | { kind: 'none' }
  | { kind: 'crop' }
  | { kind: 'edit' }
  | { kind: 'picker' }
  | { kind: 'url'; url: string }

export function openAction(el: BoardElement, readOnly: boolean): OpenAction {
  if (el.type === 'link') return { kind: 'url', url: el.url }
  if (readOnly || el.locked) return { kind: 'none' }

  switch (el.type) {
    case 'image':
      return { kind: 'crop' }
    case 'note':
    case 'frame':
      return { kind: 'edit' }
    case 'color':
      return { kind: 'picker' }
  }
}
