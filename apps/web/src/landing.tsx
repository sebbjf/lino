import { StrictMode, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import { Add01Icon, ArrowRight01Icon, LaptopIcon, UserBlock01Icon } from '@hugeicons/core-free-icons'
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
  tailwind: `@theme {
${ROLES.map((r) => `  --color-${r}: ${palette[r]};`).join('\n')}
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

// x and y are fractions of the full-screen stage, around the centered headline; the narrow stage starts as a collage.
// Sizes keep each photo's own aspect ratio.
const START: Item[] = [
  { id: 1, src: 'arch', x: 0.015, y: 0.0, w: 130, h: 195, rotation: -3 },
  { id: 2, src: 'lantern', x: 0.05, y: 0.4, w: 170, h: 255, rotation: 4 },
  { id: 3, src: 'lamp', x: 0.135, y: 0.06, w: 140, h: 210, rotation: -6 },
  { id: 4, src: 'stairs', x: 0.17, y: 0.7, w: 220, h: 147, rotation: 5 },
  { id: 5, src: 'ladder', x: 0.64, y: 0.03, w: 200, h: 134, rotation: -5 },
  { id: 6, src: 'bottle', x: 0.86, y: 0.02, w: 140, h: 179, rotation: 6 },
  { id: 7, src: 'vases', x: 0.84, y: 0.4, w: 140, h: 249, rotation: 3 },
  { id: 8, src: 'teapot', x: 0.67, y: 0.68, w: 230, h: 154, rotation: -3 },
].map((it, i) => ({ ...it, z: i + 1 }))
const startAt = (W: number, H: number) => START.map((it) => ({ ...it, x: it.x * W, y: it.y * H }))

const ARRANGE: { mode: Layout | 'scatter'; label: string }[] = [
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

  const [items, setItems] = useState(START)
  const [mode, setModeState] = useState<Layout | 'scatter' | null>(null)
  const setMode = (m: Layout | 'scatter' | null) => {
    setModeState(m)
    onArranged(m !== null && m !== 'scatter')
  }
  const zv = useMotionValue(1)
  const [z, setZ] = useState(1)
  const top = useRef(START.length)

  const apply = (m: Layout | 'scatter', from = items) => {
    const r = arrange(from, m, W, Hu)
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
    const start = startAt(W, Hu)
    if (fill) {
      setItems(start)
      setZ(1)
      setMode(null)
    } else apply('collage', start)
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
const h2 = 'mt-6 text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] font-semibold tracking-[-0.045em]'
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
    <section ref={ref} className={`px-4 sm:px-8 ${pinned ? 'h-[320vh]' : 'py-24 sm:py-36'}`}>
      <div className={pinned ? 'sticky top-0 flex h-svh items-center' : ''}>
        <div className={`${container} grid w-full gap-12 lg:grid-cols-[0.85fr_2fr] lg:items-center`}>
          <div>
            <Eyebrow>The board</Eyebrow>
            <h2 className={`${h2} text-[clamp(2.75rem,5vw,4.5rem)]`}>
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

// ---------------------------------------------------------------- tokens
function Output() {
  const [tab, setTab] = useState<'css' | 'tailwind'>('css')
  return (
    <div className="relative overflow-hidden rounded-3xl bg-foreground text-background shadow-2xl">
      <div className="flex items-center gap-1 border-b border-background/10 px-3 py-2">
        {(['css', 'tailwind'] as const).map((t) => (
          <button
            key={t}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className="rounded-full px-3 py-1 text-xs text-background/60 outline-none hover:text-background focus-visible:ring-2 focus-visible:ring-background/40 aria-pressed:bg-background/10 aria-pressed:text-background"
          >
            {t === 'css' ? 'CSS variables' : 'Tailwind v4'}
          </button>
        ))}
        <span className="ml-auto hidden gap-1.5 sm:flex">
          {ROLES.map((r) => (
            <span key={r} className="size-3 rounded-full" style={{ background: v(r) }} />
          ))}
        </span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">{exports[tab]}</pre>
    </div>
  )
}

function TokensSection() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const codeY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [60, -40])
  return (
    <section ref={ref} className={`${section} overflow-hidden pt-8 sm:pt-12`}>
      <div className={`${container} grid gap-12 md:grid-cols-12 md:items-center`}>
        <div className="md:col-span-5">
          <Eyebrow>Tokens</Eyebrow>
          <h2 className={h2}>
            <Line inView>That board,</Line>
            <Line inView delay={0.1} className="text-foreground/45">
              as tokens.
            </Line>
          </h2>
          <Reveal>
            <p className={lead}>
              Rename and pin the colors you keep, and Lino turns them into tokens you can paste into your project. Paste a link and its fonts and colors join the
              board too.
            </p>
            <p className="mt-6 font-mono text-xs text-muted-foreground">Hex or OKLCH, with your own variable prefix.</p>
          </Reveal>
        </div>
        <div className="relative md:col-span-7 md:col-start-6 md:pl-8">
          <motion.div className="relative" style={{ y: codeY }}>
            <Output />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- privacy
const promises = ['account', 'tracking', 'cookies', 'ads']

/** A big line that slides in from one side as it scrolls into view. */
function SlideLine({ from, children, className }: { from: number; children: ReactNode; className: string }) {
  const ref = useRef<HTMLLIElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center 0.6'] })
  const x = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [from, 0])
  const opacity = useTransform(scrollYProgress, [0, 1], reduced ? [1, 1] : [0.15, 1])
  return (
    <motion.li ref={ref} className={className} style={{ x, opacity }}>
      {children}
    </motion.li>
  )
}

function PrivacySection() {
  return (
    <section className={`${section} overflow-hidden bg-foreground text-background`}>
      <div className={`${container} grid gap-12 md:grid-cols-12`}>
        <div className="md:col-span-5">
          <Eyebrow dark>Private</Eyebrow>
          <h2 className={h2}>
            <Line inView>Your boards</Line>
            <Line inView delay={0.1} className="opacity-50">
              stay with you.
            </Line>
          </h2>
          <Reveal>
            <p className={`${lead} opacity-70`} style={{ color: 'inherit' }}>
              Everything you pin is saved in your browser, on this device. There is no account to make, and nothing you add leaves it unless you share a board.
            </p>
          </Reveal>
        </div>
        <ul className="md:col-span-7 md:pt-24">
          {promises.map((w, i) => (
            <SlideLine
              key={w}
              from={i % 2 ? 180 : -180}
              className={`flex items-baseline gap-4 border-t border-current/15 py-5 text-[clamp(2.75rem,6vw,5rem)] leading-none font-semibold tracking-[-0.05em] ${i % 2 ? 'md:justify-end' : ''}`}
            >
              <span className="text-[0.45em] font-medium opacity-40">
                No
              </span>
              {w}.
            </SlideLine>
          ))}
        </ul>
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
    <section className={section}>
      <div className={`${container} grid gap-12 md:grid-cols-12`}>
        <div className="md:col-span-4">
          <div className="md:sticky md:top-24">
            <Eyebrow>Questions</Eyebrow>
            <h2 className={h2}>
              <Line inView>Good</Line>
              <Line inView delay={0.1} className="text-foreground/45">
                to know.
              </Line>
            </h2>
          </div>
        </div>
        <Reveal className="border-t border-border md:col-span-7 md:col-start-6">
          {faqs.map(([q, a]) => (
            <details key={q} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-6 text-xl font-medium tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:text-2xl [&::-webkit-details-marker]:hidden">
                {q}
                <HugeiconsIcon
                  icon={Add01Icon}
                  size={20}
                  strokeWidth={1.8}
                  aria-hidden
                  className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="max-w-xl pb-6 text-muted-foreground">{a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section className="overflow-hidden bg-foreground py-24 text-background sm:py-32">
      <div className={`${container} px-4 sm:px-8`}>
        <h2 className="text-center text-[clamp(3rem,8vw,7rem)] leading-[0.95] font-semibold tracking-[-0.055em]">
          <Line inView>Start your</Line>
          <Line inView delay={0.1} className="opacity-50">
            first board.
          </Line>
        </h2>
        <Reveal className="mt-12 flex flex-col items-center gap-5">
          <a href="/board/" className={`${pill} group bg-background px-7 py-4 text-base font-medium text-foreground`}>
            Open your board
            <Arrow />
          </a>
          <p className="max-w-xs opacity-70">It opens right away, with nothing to sign up for.</p>
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
      <TokensSection />
      <PrivacySection />
      <FaqSection />
      <CtaSection />
      <footer className={`${container} flex items-center justify-between px-4 py-10 text-xs text-muted-foreground sm:px-8`}>
        <Logo />
        <span>© {new Date().getFullYear()} Lino</span>
      </footer>
    </MotionConfig>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
