import type { BoardElement, StylePatch } from '../store.ts'

type Of<T extends BoardElement['type']> = Extract<BoardElement, { type: T }>
/** The part of a saved element every kind shares (id, box, common style); snapshot.ts builds it. */
export type Box = Omit<Of<'color'>, 'type' | 'hex'>
/** `isPicture`: whether a string may be an element's picture (data URL, or an image id on a local save). */
export type ParseCtx = { isPicture: (v: unknown) => v is string }

/** Everything that varies per element type on the data side. Renderers (ElementView, png.ts) stay outside. */
export type Kind<T extends BoardElement['type']> = {
  label: string
  /** Style fields only this kind has (the rest are shared by all). */
  styleKeys: (keyof StylePatch)[]
  /** Colours it adds to the board palette. */
  colors: (el: Of<T>) => string[]
  /** Rebuilds the kind's own fields from untrusted JSON, or null if unusable. */
  parse: (e: Record<string, unknown>, box: Box, ctx: ParseCtx) => Of<T> | null
}
