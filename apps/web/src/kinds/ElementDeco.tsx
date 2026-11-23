import type { BoardElement } from '../store.ts'
import { PIN, TAPE } from './look.ts'

/** Tape or pin over the top edge, and the lock badge; drawn the same way on every kind. */
export function ElementDeco({ el, zoom }: { el: BoardElement; zoom: number }) {
  return (
    <>
      {el.deco === 'tape' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 shadow-[0_1px_2px_rgb(0_0_0/0.12)]"
          style={{ top: -TAPE.h / 2, width: TAPE.w, height: TAPE.h, background: TAPE.color, translate: '-50% 0', rotate: `${TAPE.tiltDeg}deg` }}
        />
      )}
      {el.deco === 'pin' && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full shadow-[0_2px_3px_rgb(0_0_0/0.3)]"
          style={{ top: PIN.top, width: PIN.size, height: PIN.size, background: `radial-gradient(circle at 35% 35%, ${PIN.highlight}, ${PIN.color} 60%)` }}
        />
      )}
      {el.locked && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-1.5 top-1.5 grid size-5 origin-top-right place-items-center rounded-full bg-card/90 text-card-foreground shadow-soft"
          style={{ transform: `scale(${1 / zoom})` }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
        </span>
      )}
    </>
  )
}
