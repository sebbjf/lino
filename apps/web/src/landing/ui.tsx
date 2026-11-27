import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { motion } from 'motion/react'

// ---------------------------------------------------------------- palette
// The colors on the demo boards: a light tone, an accent, a second color and a dark. The page itself stays neutral.
// The page reads them as --p-* custom properties, set in index.css.
export const ROLES = ['linen', 'orange', 'teal', 'olive'] as const
export type Role = (typeof ROLES)[number]
export type Palette = Record<Role, string>

// picked from the demo photos
export const palette: Palette = { linen: '#e4ddd1', orange: '#ef7d12', teal: '#2a8fae', olive: '#262b1d' }
export const v = (r: Role) => `var(--p-${r})`
export const dots = (size: number) => ({ backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)', backgroundSize: `${size}px ${size}px` })

/** The demo palette as the CSS export would write it. */
export const PALETTE_CSS = `:root {
${ROLES.map((r) => `  --${r}: ${palette[r]};`).join('\n')}
  --font-display: 'Newsreader', serif;
  --font-body: 'Figtree', sans-serif;
}`

export const pill =
  'inline-flex items-center gap-1.5 rounded-full outline-none transition-[color,background-color,scale] active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none'
export const darkButton = `${pill} group bg-foreground font-medium text-background`
export const ease = [0.16, 1, 0.3, 1] as const

export function Arrow() {
  return (
    <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
  )
}

export function useSize(ref: RefObject<HTMLElement | null>) {
  const [s, setS] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current!
    setS({ w: el.clientWidth, h: el.clientHeight })
    const ro = new ResizeObserver(([e]) => setS({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return s
}

export function useMedia(query: string) {
  const [m, setM] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const f = () => setM(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [query])
  return m
}

/** A pinned photo; the ones on the landing live in public/landing (Unsplash License). */
export function Photo({ src, className = '' }: { src: string; className?: string }) {
  return (
    <img
      src={`/landing/${src}.jpg`}
      alt=""
      draggable={false}
      className={`pointer-events-none size-full rounded-xl object-cover shadow-soft ring-1 ring-black/5 ${className}`}
    />
  )
}

// ---------------------------------------------------------------- small pieces
/** A word in the subtitle, outlined like a chip. */
export function Tag({ icon, color, children }: { icon: IconSvgElement; color: string; children: ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-2.5 align-middle text-sm leading-6 font-medium text-foreground">
      <HugeiconsIcon icon={icon} size={14} strokeWidth={2} style={{ color }} />
      {children}
    </span>
  )
}

export function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${dark ? 'bg-background/10 text-background/70' : 'bg-foreground/[0.06] text-foreground/70'}`}>
      {children}
    </span>
  )
}

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 56 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 1, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

/** A headline line that slides up out of its own mask. */
export function Line({ children, className = '', delay = 0, inView = false }: { children: ReactNode; className?: string; delay?: number; inView?: boolean }) {
  // the mask is what scrolls into view (the masked text itself starts clipped, so it never would)
  const variants = { hidden: { y: '110%' }, shown: { y: 0, transition: { duration: 1.1, ease, delay } } }
  return (
    <motion.span
      className={`block overflow-hidden pr-[0.1em] pb-[0.12em] ${className}`}
      initial="hidden"
      {...(inView ? { whileInView: 'shown', viewport: { once: true } } : { animate: 'shown' })}
    >
      <motion.span className="block" variants={variants}>
        {children}
      </motion.span>
    </motion.span>
  )
}

// one spacing scale for every section
export const section = 'px-4 py-24 sm:px-8 sm:py-36'
export const container = 'mx-auto max-w-6xl'
export const h2 = 'mt-6 text-balance text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] font-semibold tracking-[-0.045em]'
export const lead = 'mt-6 max-w-md text-muted-foreground'
