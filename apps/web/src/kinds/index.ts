import type { BoardElement, StylePatch } from '../store.ts'
import { color } from './color.ts'
import { image } from './image.ts'
import { link } from './link.ts'
import { note } from './note.ts'
import type { Kind } from './types.ts'

/** One entry per element type: adding a type to `BoardElement` is a compile error until it is registered here. */
export const KINDS: { [T in BoardElement['type']]: Kind<T> } = { image, note, color, link }

/** Style fields that belong to one kind only. */
export const ownStyleKeys = (type: BoardElement['type']): (keyof StylePatch)[] => KINDS[type].styleKeys
export const TYPED_KEYS = Object.values(KINDS).flatMap((k) => k.styleKeys)

/** The palette colours one element contributes. */
export const colorsOf = (el: BoardElement): string[] => (KINDS[el.type].colors as (el: BoardElement) => string[])(el)
