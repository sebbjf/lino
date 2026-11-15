import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { Add01Icon, AdvertisimentIcon, ArrowRight01Icon, CookieIcon, LaptopIcon, UserBlock01Icon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  animate,
  motion,
  MotionConfig,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react'
import { boundsOf, layoutPositions, type Layout } from './geometry.ts'
import './index.css'

// ---------------------------------------------------------------- palette
// The colors on the demo boards: a light tone, an accent, a second color and a dark. The page itself stays neutral.
// The page reads them as --p-* custom properties, set in index.css.
const ROLES = ['linen', 'orange', 'teal', 'olive'] as const
type Role = (typeof ROLES)[number]
type Palette = Record<Role, string>

// picked from the demo photos
const palette: Palette = { linen: '#e4ddd1', orange: '#ef7d12', teal: '#2a8fae', olive: '#262b1d' }
const v = (r: Role) => `var(--p-${r})`
const dots = (size: number) => ({ backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)', backgroundSize: `${size}px ${size}px` })

const exports = {
  css: `:root {
${ROLES.map((r) => `  --${r}: ${palette[r]};`).join('\n')}
  --font-display: 'Newsreader', serif;
  --font-body: 'Figtree', sans-serif;
}`,
}

const pill =
  'inline-flex items-center gap-1.5 rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none'
const darkButton = `${pill} group bg-foreground font-medium text-background`
const ease = [0.16, 1, 0.3, 1] as const

function Arrow() {
  return (
    <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
  )
}

function useSize(ref: RefObject<HTMLElement | null>) {
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

function useMedia(query: string) {
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
function Photo({ src, className = '' }: { src: string; className?: string }) {
  return (
    <img
      src={`/landing/${src}.jpg`}
      alt=""
      draggable={false}
      className={`pointer-events-none size-full rounded-xl object-cover shadow-soft ring-1 ring-black/5 ${className}`}
    />
  )
}

// ---------------------------------------------------------------- hero board
type Item = { id: number; src: string; x: number; y: number; w: number; h: number; rotation: number; z: number }

// Full screen: four photos on each side of the headline, in two staggered columns mirrored left/right.
// x is the distance from that side's edge and y is laid out for a 640-unit block centered in the stage (both in design units);
// the narrow stage starts as a collage. Sizes keep each photo's own aspect ratio.
const START = [
  { id: 1, src: 'yellow', side: 'l', x: 24, y: 40, w: 160, h: 240, rotation: -2 },
  { id: 2, src: 'fabric', side: 'l', x: 24, y: 310, w: 188, h: 125, rotation: 2 },
  { id: 3, src: 'sun', side: 'l', x: 206, y: 130, w: 140, h: 224, rotation: 2 },
  { id: 4, src: 'lantern', side: 'l', x: 206, y: 385, w: 150, h: 225, rotation: -2 },
  { id: 5, src: 'bust', side: 'r', x: 24, y: 30, w: 150, h: 225, rotation: 2 },
  { id: 6, src: 'amber', side: 'r', x: 24, y: 285, w: 170, h: 113, rotation: -2 },
  { id: 7, src: 'sleeves', side: 'r', x: 206, y: 130, w: 160, h: 120, rotation: -2 },
  { id: 8, src: 'vases', side: 'r', x: 206, y: 280, w: 135, h: 240, rotation: 2 },
].map(({ side, ...it }, i) => ({ ...it, right: side === 'r', z: i + 1 }))
const startAt = (W: number, Hu: number): Item[] =>
  START.map(({ right, ...it }) => ({ ...it, x: right ? W - it.x - it.w : it.x, y: it.y + (Hu - 640) / 2 }))

/** 'original' is the hand-placed start (a collage on narrow screens), same as on page load. */
type Mode = Layout | 'scatter' | 'original'
const ARRANGE: { mode: Mode; label: string }[] = [
  { mode: 'original', label: 'Original' },
  { mode: 'scatter', label: 'Scatter' },
  { mode: 'fan', label: 'Fan' },
  { mode: 'sunflower', label: 'Sunflower' },
  { mode: 'grid', label: 'Grid' },
  { mode: 'collage', label: 'Collage' },
]
const rand = (a: number) => (Math.random() * 2 - 1) * a

type Limits = { left: number; right: number; top: number; bottom: number }

/** One photo on the hero board: thrown with momentum, tilts with its speed, springs into layouts. */
function Piece({ item, limits, delay, onFront, onSettle }: {
  item: Item
  limits: Limits
  delay: number
  onFront: () => void
  onSettle: (x: number, y: number) => void
}) {
  const x = useMotionValue(item.x)
  const y = useMotionValue(item.y)
  const rot = useMotionValue(item.rotation)
  useEffect(() => {
    const o = { type: 'spring', stiffness: 120, damping: 17 } as const
    const all = [animate(x, item.x, o), animate(y, item.y, o), animate(rot, item.rotation, o)]
    return () => all.forEach((a) => a.stop())
  }, [item.x, item.y, item.rotation, x, y, rot])
  const tilt = useSpring(useTransform(useVelocity(x), [-2400, 2400], [-14, 14]), { stiffness: 300, damping: 26 })
  const rotate = useTransform(() => rot.get() + tilt.get())
  return (
    <motion.div
      className="pointer-events-auto absolute top-0 left-0 cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ x, y, rotate, width: item.w, height: item.h, zIndex: item.z }}
      initial={{ opacity: 0, scale: 1.25 }}
      animate={{ opacity: 1, scale: 1, transition: { delay, type: 'spring', stiffness: 260, damping: 18 } }}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.07 }}
      drag
      dragConstraints={limits}
      dragElastic={0.18}
      dragTransition={{ power: 0.3, timeConstant: 260, bounceStiffness: 420, bounceDamping: 20 }}
      onPointerDown={onFront}
      onDragTransitionEnd={() => onSettle(x.get(), y.get())}
    >
      <Photo src={item.src} />
    </motion.div>
  )
}

/** Places items in a template (or scatters them) and returns the zoom that fits them in the stage. */
function arrange(items: Item[], mode: Layout | 'scatter', W: number, Hu: number) {
  if (mode === 'scatter')
    return {
      items: items.map((it) => ({ ...it, x: 20 + Math.random() * (W - it.w - 40), y: 20 + Math.random() * (Hu - it.h - 40), rotation: rand(9) })),
      z: 1,
    }
  const pos = layoutPositions(items, mode, 18)
  const moved = items.map((it, i) => ({ ...it, ...pos[i] }))
  const b = boundsOf(moved)
  const dx = W / 2 - (b.x + b.w / 2)
  const dy = Hu / 2 - (b.y + b.h / 2)
  return { items: moved.map((it) => ({ ...it, x: it.x + dx, y: it.y + dy })), z: Math.min(1, (W - 48) / b.w, (Hu - 48) / b.h) }
}

function ToolButton({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${pill} px-2.5 py-1.5 text-sm text-foreground/70 sm:px-3 hover:bg-foreground/[0.06] hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background`}
    >
      {children}
    </button>
  )
}

type StageProps = { onArranged: (on: boolean) => void }

/**
 * Wide screens: the stage fills the hero behind the headline, photos start around it, and the toolbar
 * floats at the bottom. Narrower: a block under the text that starts as a collage, toolbar below.
 */
function Stage({ onArranged }: StageProps) {
  const outer = useRef<HTMLDivElement>(null)
  const fill = useMedia('(min-width: 1024px)')
  const { w: width, h: height } = useSize(outer)
  const W = fill ? 1440 : width < 700 ? 440 : 900
  const H = fill ? Math.round((W * (height || 900)) / (width || 1440)) : width < 700 ? 480 : 560
  const Hu = fill ? H - 110 : H
  const k = width ? width / W : 1

  const [items, setItems] = useState<Item[]>([])
  const [mode, setModeState] = useState<Mode>('original')
  const setMode = (m: Mode) => {
    setModeState(m)
    onArranged(m !== 'original' && m !== 'scatter')
  }
  const zv = useMotionValue(1)
  const [z, setZ] = useState(1)
  const top = useRef(START.length)

  const apply = (m: Mode) => {
    const start = startAt(W, Hu)
    const r = m === 'original' ? (fill ? { items: start, z: 1 } : arrange(start, 'collage', W, Hu)) : arrange(items, m, W, Hu)
    setItems(r.items)
    setZ(r.z)
    setMode(m)
  }
  useEffect(() => {
    animate(zv, z, { type: 'spring', stiffness: 120, damping: 20 })
  }, [z, zv])

  // full screen starts hand-placed around the headline; the narrow stage as a collage
  const design = useRef<string | null>(null)
  useEffect(() => {
    if (!width) return
    const key = `${fill}-${W}`
    if (design.current === key) return
    design.current = key
    apply('original')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fill, W, width])

  // what is on screen, in world units, given the zoom around the stage's center
  const cx = W / 2
  const cy = Hu / 2
  const view = { x0: cx - cx / z, x1: cx + (W - cx) / z, y0: cy - cy / z, y1: cy + (H - cy) / z }

  return (
    <div className={fill ? 'pointer-events-none absolute inset-0 z-0' : 'relative mt-10'}>
      <div ref={outer} className={fill ? 'absolute inset-0' : 'relative'} style={fill ? undefined : { height: width ? H * k : 480 }}>
        {width > 0 && design.current && (
          <MotionConfig transformPagePoint={(p) => ({ x: p.x / (k * zv.get()), y: p.y / (k * zv.get()) })}>
            <div className="absolute top-0 left-0 origin-top-left" style={{ width: W, height: H, transform: `scale(${k})` }}>
              <motion.div className="absolute inset-0" style={{ scale: zv, transformOrigin: `${cx}px ${cy}px` }}>
                {items.map((it, i) => (
                  <Piece
                    key={it.id}
                    item={it}
                    delay={0.5 + i * 0.07}
                    limits={{ left: view.x0, right: view.x1 - it.w, top: view.y0, bottom: view.y1 - it.h }}
                    onFront={() => setItems((s) => s.map((o) => (o.id === it.id ? { ...o, z: ++top.current } : o)))}
                    onSettle={(x, y) => setItems((s) => s.map((o) => (o.id === it.id ? { ...o, x, y } : o)))}
                  />
                ))}
              </motion.div>
            </div>
          </MotionConfig>
        )}
      </div>

      <div className="pointer-events-auto mt-4 flex flex-col items-center gap-2.5 lg:absolute lg:bottom-6 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2">
        <p className="text-xs text-muted-foreground">Drag the photos around, or try a layout</p>
        <div
          role="toolbar"
          aria-label="Arrange the photos"
          className="flex flex-wrap items-center justify-center gap-0.5 rounded-full border border-border/70 bg-card/90 p-1.5 shadow-soft backdrop-blur"
        >
          {ARRANGE.map((a) => (
            <ToolButton key={a.mode} pressed={mode === a.mode} onClick={() => apply(a.mode)}>
              {a.label}
            </ToolButton>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- small pieces
/** A word in the subtitle, outlined like a chip. */
function Tag({ children }: { children: ReactNode }) {
  return <span className="mx-0.5 inline-block rounded-full border border-foreground/15 px-2.5 text-sm leading-6 font-medium text-foreground">{children}</span>
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${dark ? 'bg-background/10 text-background/70' : 'bg-foreground/[0.06] text-foreground/70'}`}>
      {children}
    </span>
  )
}

function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
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
function Line({ children, className = '', delay = 0, inView = false }: { children: ReactNode; className?: string; delay?: number; inView?: boolean }) {
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
const section = 'px-4 py-24 sm:px-8 sm:py-36'
const container = 'mx-auto max-w-6xl'
const h2 = 'mt-6 text-balance text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] font-semibold tracking-[-0.045em]'
const lead = 'mt-6 max-w-md text-muted-foreground'

// ---------------------------------------------------------------- demo
// demo timeline, in ticks: each photo, then each palette row, then the code lines
const AT = { photo: 1, row: 6, code: 11, end: 26 }
const STEPS = [
  { at: AT.photo, label: 'Pin your references' },
  { at: AT.row, label: 'Colors land in the palette' },
  { at: AT.code, label: 'The palette becomes tokens' },
]

const pop = (on: boolean) =>
  `transition-[opacity,translate,scale] duration-500 ease-out motion-reduce:transition-none ${on ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`

const demoPhotos = [
  { src: 'lantern', className: 'top-[9%] left-[5%] h-40 w-[107px] sm:h-56 sm:w-[149px]', rotate: '-4deg' },
  { src: 'chair', className: 'top-[20%] left-[33%] h-32 w-[85px] sm:h-48 sm:w-32', rotate: '3deg' },
  { src: 'teapot', className: 'top-[7%] left-[58%] h-20 w-[120px] sm:h-28 sm:w-[168px]', rotate: '5deg' },
  { src: 'plant', className: 'top-[46%] left-[62%] h-32 w-[94px] sm:h-44 sm:w-[129px]', rotate: '-6deg' },
]

/** The real flow, played by the scroll: pin things, the palette fills, the tokens appear. */
function DemoBoard({ t }: { t: number }) {
  const codeLines = exports.css.split('\n')
  return (
    <div
      role="img"
      aria-label="Demo: four photos are pinned to a board, their colors land in the palette, and the palette becomes CSS variables."
      className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft"
    >
      <div aria-hidden className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-border" />
        ))}
        <span className="ml-3">Kitchen rebrand</span>
      </div>
      <div aria-hidden className="grid sm:grid-cols-[1fr_280px]">
        <div className="relative h-80 sm:h-[380px]" style={dots(20)}>
          {demoPhotos.map((ph, i) => (
            <div key={ph.src} className={`absolute ${ph.className} ${pop(t >= AT.photo + i)}`} style={{ rotate: ph.rotate }}>
              <Photo src={ph.src} />
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 p-4 sm:border-t-0 sm:border-l">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Palette</p>
          <ul className="mt-2 space-y-1">
            {ROLES.map((r, i) => (
              <li key={r} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${pop(t >= AT.row + i)}`}>
                <span className="size-5 rounded-md ring-1 ring-black/5" style={{ background: v(r) }} />
                <span className="font-medium">{r}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{palette[r]}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 overflow-hidden rounded-xl bg-foreground text-background">
            <div className="flex justify-between border-b border-background/10 px-3 py-1.5 text-[11px] text-background/60">
              <span>CSS variables</span>
            </div>
            <pre className="overflow-hidden p-3 font-mono text-[10.5px] leading-relaxed">
              {codeLines.map((line, i) => (
                <div key={i} className={`transition-opacity duration-300 motion-reduce:transition-none ${t >= AT.code + i ? 'opacity-100' : 'opacity-0'}`}>
                  {line}
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

/** On wide screens the section pins and the scroll plays the demo; elsewhere it plays as it scrolls past. */
function DemoSection() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const pinned = useMedia('(min-width: 1024px) and (min-height: 700px)') && !reduced
  const { scrollYProgress } = useScroll({ target: ref, offset: pinned ? ['start start', 'end end'] : ['start 0.9', 'end 0.6'] })
  const [t, setT] = useState(reduced ? AT.end : 0)
  useMotionValueEvent(scrollYProgress, 'change', (p) => !reduced && setT(Math.round(Math.min(1, p / 0.9) * AT.end)))
  const bar = useTransform(scrollYProgress, [0, 0.9], ['0%', '100%'])
  return (
    <section ref={ref} id="how-it-works" className={`px-4 sm:px-8 ${pinned ? 'h-[320vh]' : 'py-24 sm:py-36'}`}>
      <div className={pinned ? 'sticky top-0 flex h-svh items-center' : ''}>
        <div className={`${container} grid w-full gap-12 lg:grid-cols-[1fr_2fr] lg:items-center`}>
          <div>
            <Eyebrow>The board</Eyebrow>
            <h2 className="mt-6 text-[clamp(2.5rem,3.4vw,3.25rem)] leading-[1] font-semibold tracking-[-0.045em] text-balance">
              <Line inView>Collect it all.</Line>
              <Line inView delay={0.1} className="text-foreground/45">
                Keep the colors.
              </Line>
            </h2>
            <p className={lead}>Drop in images, jot down notes and add swatches. Every color you add lands in the palette, ready to rename and pin.</p>
            <ol className="mt-10 hidden space-y-3 lg:block">
              {STEPS.map((s, i) => (
                <li key={s.label} className={`flex items-baseline gap-3 transition-colors duration-500 ${t >= s.at ? 'text-foreground' : 'text-foreground/30'}`}>
                  <span className="font-mono text-xs">0{i + 1}</span>
                  <span className="text-xl font-medium tracking-tight">{s.label}</span>
                </li>
              ))}
            </ol>
            {pinned && (
              <div aria-hidden className="mt-8 h-px w-full max-w-xs bg-border">
                <motion.div className="h-full bg-foreground" style={{ width: bar }} />
              </div>
            )}
          </div>
          <DemoBoard t={t} />
        </div>
      </div>
    </section>
  )
}


// ---------------------------------------------------------------- privacy
const promises = [
  { label: 'No account', note: 'Open the board and start pinning.', icon: UserBlock01Icon },
  { label: 'No tracking', note: 'Nothing you add is sent to a server.', icon: ViewOffSlashIcon },
  { label: 'No cookies', note: 'Nothing to accept before you start.', icon: CookieIcon },
  { label: 'No ads', note: 'Just your board.', icon: AdvertisimentIcon },
]

// a small board on "this device": four of the hero's photos, pinned loosely
const privatePhotos = [
  { src: 'bust', className: 'left-[7%] top-[7%] w-[30%] aspect-[2/3] -rotate-3' },
  { src: 'sun', className: 'left-[41%] top-[4%] w-[24%] aspect-[5/8] rotate-2' },
  { src: 'amber', className: 'left-[64%] top-[30%] w-[30%] aspect-[3/2] -rotate-2' },
  { src: 'fabric', className: 'left-[14%] top-[60%] w-[40%] aspect-[3/2] rotate-2' },
]

function PrivacySection() {
  return (
    <section id="privacy" className={section}>
      <div className={`${container} grid items-center gap-14 lg:grid-cols-2 lg:gap-20`}>
        <div>
          <Eyebrow>Private</Eyebrow>
          <h2 className={h2}>
            <Line inView>Your boards</Line>
            <Line inView delay={0.1} className="text-foreground/45">
              stay with you.
            </Line>
          </h2>
          <Reveal>
            <p className={lead}>
              Everything you pin is saved in your browser, on this device. There is no account to make, and nothing you add leaves it unless you share a board.
            </p>
          </Reveal>
          <ul className="mt-10 divide-y divide-border border-y border-border">
            {promises.map((p, i) => (
              <motion.li
                key={p.label}
                className="flex items-center gap-4 py-4"
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease, delay: i * 0.06 }}
              >
                <HugeiconsIcon icon={p.icon} size={20} strokeWidth={1.6} aria-hidden className="shrink-0" />
                <span className="w-28 shrink-0 text-sm font-medium">{p.label}</span>
                <span className="text-sm text-muted-foreground">{p.note}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <Reveal>
          <div className="relative aspect-[4/3.4] rounded-[2rem] border border-border bg-card shadow-soft">
            <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:18px_18px]" />
            {privatePhotos.map((p, i) => (
              <motion.div
                key={p.src}
                className={`absolute ${p.className}`}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.9, ease, delay: 0.15 + i * 0.08 }}
              >
                <Photo src={p.src} />
              </motion.div>
            ))}
            <div className="absolute right-5 bottom-5 flex items-center gap-2 rounded-full border border-border bg-card/90 px-4 py-2 text-xs font-medium whitespace-nowrap shadow-soft backdrop-blur">
              <HugeiconsIcon icon={LaptopIcon} size={14} strokeWidth={1.8} aria-hidden />
              Saved on this device
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- faq, cta
const faqs = [
  ['Where are my boards saved?', "In your browser's storage on this device. Nothing you pin, images included, is sent to a server unless you share the board."],
  ['What happens if I clear my browser data?', 'Your board is deleted with it. Export it first as a .lino.json file to keep a copy you can import later, or download it as a PNG.'],
  ['Can I open a board on another device?', 'Export the board as a .lino.json file and import it there. Or share a read-only link: it is a fixed copy that lasts 90 days.'],
  ['How do I use the palette in my project?', 'Open the palette and copy it as CSS variables or a Tailwind v4 theme, in hex or OKLCH. Fonts read from your links come along.'],
  ['Do I need an account?', 'No. Open the board and start pinning.'],
]

function FaqSection() {
  return (
    <section id="faq" className={`${section} pt-0 sm:pt-0`}>
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <Eyebrow>Questions</Eyebrow>
          <h2 className={h2}>
            <Line inView>Good to know.</Line>
          </h2>
        </div>
        <Reveal className="mt-12 space-y-2">
          {faqs.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-border bg-card px-5 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl py-4 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {q}
                <HugeiconsIcon
                  icon={Add01Icon}
                  size={18}
                  strokeWidth={1.8}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="pb-5 text-sm leading-6 text-muted-foreground">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

// a small hand of the hero's photos above the last call to action
const ctaPhotos = ['yellow', 'bust', 'lantern', 'sun', 'amber']

function CtaSection() {
  return (
    <section className={`${section} pt-0 sm:pt-0`}>
      <div className={`${container} rounded-[2rem] border border-border bg-card px-6 py-20 text-center shadow-soft sm:py-24`}>
        <Reveal className="flex justify-center">
          {ctaPhotos.map((src, i) => (
            <motion.div
              key={src}
              className="-mx-2 h-32 w-24 sm:-mx-3 sm:h-44 sm:w-32"
              style={{ rotate: (i - 2) * 7, y: Math.abs(i - 2) * 10, zIndex: 5 - Math.abs(i - 2) }}
              whileHover={{ y: -12, scale: 1.05 }}
            >
              <Photo src={src} />
            </motion.div>
          ))}
        </Reveal>
        <h2 className="mt-14 text-[clamp(2.5rem,6vw,4.75rem)] leading-[1] font-semibold tracking-[-0.05em] text-balance">
          <Line inView>Start your first board.</Line>
        </h2>
        <Reveal className="mt-8 flex flex-col items-center gap-4">
          <a href="/board/" className={`${darkButton} px-6 py-3 text-sm shadow-soft`}>
            Open your board
            <Arrow />
          </a>
          <p className="text-sm text-muted-foreground">It opens right away, with nothing to sign up for.</p>
        </Reveal>
      </div>
    </section>
  )
}

/** Wordmark with the board palette as overlapping dots. */
function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span aria-hidden className="flex -space-x-1.5">
        {ROLES.map((r) => (
          <span key={r} className="size-3.5 rounded-full ring-2 ring-background" style={{ background: v(r) }} />
        ))}
      </span>
      <span className="text-xl leading-none font-semibold tracking-tight">Lino</span>
    </a>
  )
}

const footerLinks = [
  { title: 'Product', links: [['Open your board', '/board/'], ['How it works', '#how-it-works']] },
  { title: 'Lino', links: [['Privacy', '#privacy'], ['Questions', '#faq']] },
]

function Footer() {
  return (
    <footer className="px-4 pt-20 pb-10 sm:px-8">
      <div className={`${container} grid gap-12 sm:grid-cols-[1.5fr_1fr_1fr]`}>
        <div className="space-y-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">A calm moodboard for images, notes and colors. No account needed.</p>
        </div>
        {footerLinks.map((col) => (
          <nav key={col.title} aria-label={col.title} className="space-y-3 text-sm">
            <p className="font-medium">{col.title}</p>
            <ul className="space-y-2 text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="rounded-sm outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={`${container} mt-16 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:justify-between`}>
        <span>© {new Date().getFullYear()} Lino</span>
        <span>
          Photos from{' '}
          <a href="https://unsplash.com" className="underline-offset-2 hover:text-foreground hover:underline">
            Unsplash
          </a>
        </span>
      </div>
    </footer>
  )
}

// ---------------------------------------------------------------- page
function Hero() {
  const [arranged, setArranged] = useState(false)
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden">
      <header className="relative z-30 px-4 pt-4 sm:px-8">
        <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border/60 bg-card/70 py-2 pr-2 pl-4 shadow-soft backdrop-blur">
          <Logo />
          <a href="/board/" className={`${darkButton} px-4 py-2 text-sm`}>
            Open your board
            <Arrow />
          </a>
        </nav>
      </header>

      <main className="relative flex flex-1 flex-col justify-center px-4 pt-8 pb-16 sm:px-8 lg:pb-36">
        <div
          className={`pointer-events-none relative z-10 mx-auto max-w-4xl text-center transition-opacity duration-700 ${arranged ? 'opacity-15' : ''}`}
        >
          <h1 className="text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] font-semibold tracking-[-0.055em]">
            <Line delay={0.05}>Your references,</Line>
            <Line delay={0.18}>
              <span className="text-foreground/45">on one board.</span>
            </Line>
          </h1>
          <Reveal delay={0.35}>
            <p className="mx-auto mt-8 max-w-md text-base leading-8 text-muted-foreground">
              Pin <Tag>images</Tag>, <Tag>links</Tag>, <Tag>notes</Tag> and <Tag>colors</Tag>, and keep the colors you like in a palette.
            </p>
          </Reveal>
          <Reveal delay={0.45} className="mt-10 flex flex-col items-center gap-4">
            <a
              href="/board/"
              className="pointer-events-auto rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-soft transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              Start a board
            </a>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <HugeiconsIcon icon={UserBlock01Icon} size={14} strokeWidth={1.8} aria-hidden />
              No account
              <span aria-hidden>·</span>
              <HugeiconsIcon icon={LaptopIcon} size={14} strokeWidth={1.8} aria-hidden />
              Saved in your browser
            </p>
          </Reveal>
        </div>
        <Stage onArranged={setArranged} />
      </main>
    </div>
  )
}

function Landing() {
  return (
    <MotionConfig reducedMotion="user">
      <Hero />
      <DemoSection />
      <PrivacySection />
      <FaqSection />
      <CtaSection />
      <Footer />
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
