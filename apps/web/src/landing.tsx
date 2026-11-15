import { StrictMode, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/caveat'
import { Add01Icon, ArrowRight01Icon, LaptopIcon, UserBlock01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import './index.css'

// the same four colors and two fonts appear on the boards and in the code
const palette = [
  { name: 'sand', hex: '#e8d5c4' },
  { name: 'clay', hex: '#c97b5a' },
  { name: 'sage', hex: '#6f8a6b' },
  { name: 'ink', hex: '#2f3a4a' },
]
const [sand, clay, sage, ink] = palette.map((c) => c.hex)
const caveat = { fontFamily: "'Caveat Variable', cursive" }

const exports = {
  css: `:root {
${palette.map((c) => `  --${c.name}: ${c.hex};`).join('\n')}
  --font-display: 'Newsreader', serif;
  --font-body: 'Figtree', sans-serif;
}`,
  tailwind: `@theme {
${palette.map((c) => `  --color-${c.name}: ${c.hex};`).join('\n')}
  --font-display: 'Newsreader', serif;
  --font-body: 'Figtree', sans-serif;
}`,
}

const pill =
  'inline-flex items-center gap-1.5 rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none'
const darkButton = `${pill} group bg-foreground font-medium text-background`

function Arrow() {
  return (
    <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
  )
}

/** A board element you can push around, like on the real board. */
function Card({ className, rotate, children }: { className: string; rotate: number; children: ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const start = useRef<{ x: number; y: number } | null>(null)
  return (
    <div
      className={`pointer-events-auto absolute cursor-grab touch-none select-none active:cursor-grabbing active:z-10 ${className}`}
      style={{ transform: `translate(${pos.x}px, ${pos.y}px) rotate(${rotate}deg)` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
      }}
      onPointerMove={(e) => start.current && setPos({ x: e.clientX - start.current.x, y: e.clientY - start.current.y })}
      onPointerUp={() => (start.current = null)}
    >
      <div className="card-drop">{children}</div>
    </div>
  )
}

/** An "image": a flat poster, the kind of reference people pin. */
function Poster({ className }: { className: string }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-soft ${className}`} style={{ background: sand }}>
      <div className="absolute top-[30%] left-1/2 aspect-square w-[58%] -translate-x-1/2 rounded-full" style={{ background: clay }} />
      <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: ink }} />
      <div className="absolute inset-x-0 bottom-[38%] h-2" style={{ background: sage }} />
    </div>
  )
}

function Swatch({ hex, size }: { hex: string; size: string }) {
  return (
    <div className={`${size} relative rounded-2xl shadow-soft`} style={{ background: hex }}>
      <span className="absolute bottom-2 left-2 rounded-full bg-card/90 px-2 py-0.5 font-mono text-[11px]">{hex}</span>
    </div>
  )
}

function HeroBoard() {
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto mt-14 h-80 w-full max-w-sm lg:absolute lg:inset-0 lg:mt-0 lg:h-auto lg:max-w-none">
      <Card rotate={-4} className="top-0 left-0 lg:top-[30%] lg:left-[2%]">
        <Poster className="h-44 w-36 lg:h-52 lg:w-40 xl:h-60 xl:w-48" />
      </Card>

      <Card rotate={6} className="top-48 left-24 lg:top-auto lg:bottom-[14%] lg:left-[17%]">
        <Swatch hex={sage} size="size-24 lg:size-32" />
      </Card>

      <Card rotate={3} className="top-2 right-0 lg:top-[38%] lg:right-[2%]">
        <div className="w-40 rounded-2xl bg-card p-4 shadow-soft lg:w-52">
          <p className="text-2xl leading-tight font-medium lg:text-3xl" style={caveat}>
            less grey, more clay. warm but not orange.
          </p>
        </div>
      </Card>

      {/* a link card, showing the typefaces read from a page's CSS */}
      <Card rotate={-3} className="right-2 bottom-0 lg:right-[11%] lg:bottom-[12%]">
        <div className="w-44 overflow-hidden rounded-2xl bg-card shadow-soft lg:w-56">
          <div className="grid h-24 place-items-center lg:h-28" style={{ background: ink, color: sand }}>
            <span className="text-6xl font-semibold tracking-tight lg:text-7xl">Aa</span>
          </div>
          <div className="space-y-1 p-3">
            <p className="text-sm font-medium">Figtree</p>
            <p className="text-xs text-muted-foreground">+ Newsreader · read from the page</p>
          </div>
        </div>
      </Card>

      <Card rotate={-8} className="hidden lg:top-[3%] lg:right-[26%] lg:block">
        <Swatch hex={clay} size="size-24" />
      </Card>
    </div>
  )
}

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

// one spacing scale for every section: same padding, width and eyebrow → title → text → content steps
const section = 'px-4 py-24 sm:px-8 sm:py-32'
const container = 'mx-auto max-w-5xl'
const h2 = 'mt-5 font-heading text-[clamp(2.5rem,5vw,4rem)] leading-[0.95]'
const lead = 'mt-6 max-w-md text-muted-foreground'

// demo timeline, in ticks: poster, note, then each swatch with its palette row one tick later, then the code lines
const TICK = 450
const AT = { poster: 1, note: 3, swatch: 5, row: 6, code: 11, end: 26 }
const codeLines = exports.css.split('\n')

/** Ticks through the demo while it is on screen and not hovered; holds the last frame under reduced motion. */
function useTimeline(ref: RefObject<HTMLElement | null>) {
  const [reduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [t, setT] = useState(reduced ? AT.end : 0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.3 })
    io.observe(ref.current!)
    return () => io.disconnect()
  }, [ref])
  useEffect(() => {
    if (reduced || paused || !visible) return
    const id = setInterval(() => setT((v) => (v >= AT.end ? 0 : v + 1)), TICK)
    return () => clearInterval(id)
  }, [reduced, paused, visible])
  return { t, setPaused }
}

const pop = (on: boolean) =>
  `transition-[opacity,translate,scale] duration-500 ease-out motion-reduce:transition-none ${on ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`

const demoSwatches = [
  { left: '46%', top: '56%', rotate: '6deg' },
  { left: '61%', top: '48%', rotate: '-5deg' },
  { left: '74%', top: '62%', rotate: '8deg' },
  { left: '57%', top: '73%', rotate: '-7deg' },
]

/** The real flow, playing by itself: pin things, the palette fills, the tokens appear. */
function DemoBoard() {
  const ref = useRef<HTMLDivElement>(null)
  const { t, setPaused } = useTimeline(ref)
  return (
    <div
      ref={ref}
      role="img"
      aria-label="Demo: an image, a note and four colors are pinned to a board, each color lands in the palette, and the palette becomes CSS variables."
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="mx-auto mt-16 max-w-5xl overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft"
    >
      <div aria-hidden className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3 text-xs text-muted-foreground">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2.5 rounded-full bg-border" />
        ))}
        <span className="ml-3">Kitchen rebrand</span>
      </div>
      <div aria-hidden className="grid sm:grid-cols-[1fr_300px]">
        <div
          className="relative h-80 sm:h-[420px]"
          style={{ backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
        >
          <div className={`absolute top-[12%] left-[6%] ${pop(t >= AT.poster)}`} style={{ rotate: '-4deg' }}>
            <Poster className="h-36 w-28 sm:h-52 sm:w-40" />
          </div>
          <div className={`absolute top-[8%] left-[40%] ${pop(t >= AT.note)}`} style={{ rotate: '3deg' }}>
            <div className="w-36 rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60 sm:w-44 sm:p-4">
              <p className="text-xl leading-tight font-medium sm:text-2xl" style={caveat}>
                warm, calm, a little earthy
              </p>
            </div>
          </div>
          {palette.map((c, i) => (
            <div key={c.hex} className={`absolute ${pop(t >= AT.swatch + i)}`} style={demoSwatches[i]}>
              <div className="size-16 rounded-xl shadow-soft ring-1 ring-black/5 sm:size-20" style={{ background: c.hex }} />
            </div>
          ))}
        </div>

        <div className="border-t border-border/60 p-4 sm:border-t-0 sm:border-l">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">Palette</p>
          <ul className="mt-2 space-y-1">
            {palette.map((c, i) => (
              <li key={c.hex} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm ${pop(t >= AT.row + i)}`}>
                <span className="size-5 rounded-md ring-1 ring-black/5" style={{ background: c.hex }} />
                <span className="font-medium">{c.name}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{c.hex}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 overflow-hidden rounded-xl bg-foreground text-background">
            <div className="flex justify-between border-b border-background/10 px-3 py-1.5 text-[11px] text-background/60">
              <span>CSS variables</span>
              <span>soon</span>
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

function Output() {
  const [tab, setTab] = useState<keyof typeof exports>('css')
  return (
    <div className="overflow-hidden rounded-3xl bg-foreground text-background">
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
          {palette.map((c) => (
            <span key={c.hex} className="size-3 rounded-full" style={{ background: c.hex }} />
          ))}
        </span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">{exports[tab]}</pre>
    </div>
  )
}

/** Wordmark with the board palette as overlapping dots. */
function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span aria-hidden className="flex -space-x-1.5">
        {palette.map((c) => (
          <span key={c.hex} className="size-3.5 rounded-full ring-2 ring-background" style={{ background: c.hex }} />
        ))}
      </span>
      <span className="font-heading text-2xl leading-none">Lino</span>
    </a>
  )
}

const promises = ['account', 'tracking', 'uploads', 'ads']

const faqs = [
  ['Where are my boards saved?', "In your browser's storage on this device. Nothing you pin, images included, is sent to a server."],
  ['What happens if I clear my browser data?', 'Your boards are deleted with it. Share links and exporting a board as an image are planned, so you can keep a copy.'],
  ['Can I open a board on another device?', 'Not yet. A board lives in the browser where you made it. Read-only share links are planned.'],
  ['When can I export the palette?', 'Export to CSS variables and Tailwind v4 ships in the next release, together with reading fonts and colors from links.'],
  ['Do I need an account?', 'No. Open the board and start pinning.'],
]

function Landing() {
  return (
    <>
      <div
        className="relative flex min-h-svh flex-col overflow-hidden"
        style={{ backgroundImage: 'radial-gradient(var(--color-dot) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
      >
        <header className="relative z-20 px-4 pt-4 sm:px-8">
          <nav className="mx-auto flex max-w-5xl items-center justify-between rounded-full border border-border/60 bg-card/70 py-2 pr-2 pl-4 shadow-soft backdrop-blur">
            <Logo />
            <a href="/board/" className={`${darkButton} px-4 py-2 text-sm`}>
              Open your board
              <Arrow />
            </a>
          </nav>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-4 pt-8 pb-16 sm:px-8">
          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <h1 className="font-heading text-[clamp(3rem,6vw,5.75rem)] leading-[0.92] tracking-[-0.04em]">
              Your references, <br className="hidden sm:block" />
              <em>on one board</em>.
            </h1>
            <p className="mx-auto mt-8 max-w-md text-base leading-8 text-muted-foreground">
              Pin <Tag>images</Tag>, <Tag>notes</Tag> and <Tag>colors</Tag>, and keep the colors you like in a palette.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4">
              <a
                href="/board/"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-soft transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
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
            </div>
          </div>
          <HeroBoard />
        </main>
      </div>

      <section className={section}>
        <div className={`${container} text-center`}>
          <Eyebrow>The board</Eyebrow>
          <h2 className={h2}>
            Collect it all. Keep the colors.
          </h2>
          <p className={`${lead} mx-auto`}>
            Drop in images, jot down notes and add swatches. Every color you add lands in the palette, ready to rename and pin.
          </p>
        </div>
        <DemoBoard />
      </section>

      <section className={`${section} pt-0 sm:pt-0`}>
        <div className={`${container} grid items-center gap-16 md:grid-cols-[1fr_1.2fr]`}>
          <div>
            <Eyebrow>Tokens</Eyebrow>
            <h2 className={h2}>
              That board, as tokens.
            </h2>
            <p className={lead}>
              Rename and pin the colors you keep, and Lino turns them into tokens you can paste into your project. Fonts will
              come from the pages you link.
            </p>
            <p className="mt-6 font-mono text-xs text-muted-foreground">Export and link reading ship in the next release.</p>
          </div>
          <Output />
        </div>
      </section>

      <section className={`${section} bg-foreground text-background`}>
        <div className={container}>
          <Eyebrow dark>Private</Eyebrow>
          <h2 className={h2}>
            Your boards stay with you.
          </h2>
          <p className={`${lead} text-background/60`}>
            Everything you pin is saved in your browser, on this device. There is no account to make, and nothing you add is
            sent to a server.
          </p>
          <ul className="mt-16 grid gap-x-16 sm:grid-cols-2">
            {promises.map((w) => (
              <li key={w} className="flex items-baseline gap-4 border-t border-background/10 py-6 font-heading text-4xl">
                <span className="w-6 font-sans text-xs font-medium tracking-[0.2em] text-background/50 uppercase">No</span>
                {w}.
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={section}>
        <div className={`${container} grid gap-16 md:grid-cols-[1fr_1.6fr]`}>
          <div>
            <Eyebrow>Questions</Eyebrow>
            <h2 className={h2}>
              Good to know.
            </h2>
          </div>
          <div className="border-t border-border">
            {faqs.map(([q, a]) => (
              <details key={q} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 text-lg font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                  {q}
                  <HugeiconsIcon
                    icon={Add01Icon}
                    size={18}
                    strokeWidth={1.8}
                    aria-hidden
                    className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                  />
                </summary>
                <p className="max-w-xl pb-5 text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={`${section} pt-0 sm:pt-0`}>
        <div className={`${container} rounded-3xl border border-border/60 bg-card px-6 py-24 text-center shadow-soft`}>
          <h2 className="font-heading text-[clamp(2.75rem,6vw,4.5rem)] leading-[0.95]">
            Start your first board.
          </h2>
          <p className={`${lead} mx-auto`}>It opens right away, with nothing to sign up for.</p>
          <a href="/board/" className={`${darkButton} mt-10 px-6 py-3 text-sm`}>
            Open your board
            <Arrow />
          </a>
        </div>
      </section>

      <footer className={`${container} flex items-center justify-between border-t border-border/60 px-4 py-10 text-xs text-muted-foreground sm:px-8`}>
        <Logo />
        <span>© {new Date().getFullYear()} Lino</span>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
