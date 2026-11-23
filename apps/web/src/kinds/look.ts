// What an element looks like, in one place: the body components (CSS) and png.ts (canvas) both read these, so a card's look is tweaked here.
import { textOn } from '../style.ts'
import type { BoardElement } from '../store.ts'

type Note = Extract<BoardElement, { type: 'note' }>

/** Inner padding of note and link cards, in board px. */
export const CARD_PAD = 16

/** A heading with no card colour is bare: it is drawn straight on the board, in the board's ink, with no card behind it. */
export const isBare = (el: BoardElement) => el.type === 'note' && !!el.heading && !el.bg

/** A note's text colour, or undefined for the card's own foreground. `ink` is the board's ink (for bare headings). */
export const noteInk = (el: Note, ink: string) => el.color ?? ((el.bg && textOn(el.bg)) || (isBare(el) ? ink : undefined))

/** Link card: colour dot diameter and gap, and the most height the text block may take below the cover image. */
export const LINK_DOT = 16
export const LINK_DOT_GAP = 6
export const LINK_TEXT_MAX_H = 110
/** png only: where the dots' centres sit above the card's bottom edge (the board view lays them out by flow). */
export const LINK_DOT_CENTER_FROM_BOTTOM = 20

/** Washi tape over the top edge (centred, tilted) and a pin near it. */
export const TAPE = { w: 80, h: 24, tiltDeg: -3, color: 'rgb(250 244 225 / 0.75)' }
export const PIN = { size: 16, top: 8, color: '#c2412d', highlight: '#f08a76' }
