import { StrictMode, useRef, useState, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/caveat'
import { ArrowRight01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import './index.css'

// the same four colors and two fonts appear on the board above and in the code below
const palette = [
  { name: 'sand', hex: '#e8d5c4' },
  { name: 'clay', hex: '#c97b5a' },
  { name: 'sage', hex: '#6f8a6b' },
  { name: 'ink', hex: '#2f3a4a' },
]

const exports = {
  css: `:root {
${palette.map((c) => `  --${c.name}: ${c.hex};`).join('\n')}
  --font-display: 'Playfair', serif;
  --font-body: 'Figtree', sans-serif;
}`,
  tailwind: `@theme {
${palette.map((c) => `  --color-${c.name}: ${c.hex};`).join('\n')}
  --font-display: 'Playfair', serif;
  --font-body: 'Figtree', sans-serif;
}`,
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
      {children}
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

function Board() {
  return (
    <div aria-hidden className="pointer-events-none relative mx-auto mt-14 h-80 w-full max-w-sm lg:absolute lg:inset-0 lg:mt-0 lg:h-auto lg:max-w-none">
      {/* an "image": a flat poster, the kind of reference people pin */}
      <Card rotate={-4} className="top-0 left-0 lg:top-[12%] lg:left-[6%]">
        <div className="relative h-44 w-36 overflow-hidden rounded-2xl shadow-soft lg:h-60 lg:w-48" style={{ background: '#e8d5c4' }}>
          <div className="absolute top-[30%] left-1/2 size-20 -translate-x-1/2 rounded-full lg:size-28" style={{ background: '#c97b5a' }} />
          <div className="absolute inset-x-0 bottom-0 h-[38%]" style={{ background: '#2f3a4a' }} />
          <div className="absolute inset-x-0 bottom-[38%] h-2" style={{ background: '#6f8a6b' }} />
        </div>
      </Card>

      <Card rotate={6} className="top-48 left-24 lg:top-auto lg:bottom-[14%] lg:left-[17%]">
        <Swatch hex="#6f8a6b" size="size-24 lg:size-32" />
      </Card>

      <Card rotate={3} className="top-2 right-0 lg:top-[14%] lg:right-[7%]">
        <div className="w-40 rounded-2xl bg-card p-4 shadow-soft lg:w-52">
          <p className="text-2xl leading-tight font-medium lg:text-3xl" style={{ fontFamily: "'Caveat Variable', cursive" }}>less grey, more clay. warm but not orange.</p>
        </div>
      </Card>

      {/* a link card, showing the typefaces read from a page's CSS */}
      <Card rotate={-3} className="right-2 bottom-0 lg:right-[11%] lg:bottom-[12%]">
        <div className="w-44 overflow-hidden rounded-2xl bg-card shadow-soft lg:w-56">
          <div className="grid h-24 place-items-center lg:h-28" style={{ background: '#2f3a4a', color: '#e8d5c4' }}>
            <span className="text-6xl font-semibold tracking-tight lg:text-7xl">Aa</span>
          </div>
          <div className="space-y-1 p-3">
            <p className="text-sm font-medium">Figtree</p>
            <p className="text-xs text-muted-foreground">+ Playfair · read from the page</p>
          </div>
        </div>
      </Card>

      <Card rotate={-8} className="hidden lg:top-[9%] lg:right-[26%] lg:block">
        <Swatch hex="#c97b5a" size="size-24" />
      </Card>
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
          {palette.map((c) => <span key={c.hex} className="size-3 rounded-full" style={{ background: c.hex }} />)}
        </span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">{exports[tab]}</pre>
    </div>
  )
}

/** Wordmark with the board palette as overlapping dots. */
function Logo({ className = '' }: { className?: string }) {
  return (
    <a href="/" className={`flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 ${className}`}>
      <span aria-hidden className="flex -space-x-1.5">
        {palette.map((c) => (
          <span key={c.hex} className="size-3.5 rounded-full ring-2 ring-background" style={{ background: c.hex }} />
        ))}
      </span>
      <span className="font-heading text-2xl leading-none">Lino</span>
    </a>
  )
}

const pill =
  'inline-flex items-center gap-1.5 rounded-full outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none'

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
            <a href="/board/" className={`${pill} group bg-foreground px-4 py-2 text-sm font-medium text-background`}>
              Open your board
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </a>
          </nav>
        </header>

        <main className="relative flex flex-1 flex-col justify-center px-4 pt-8 pb-16 sm:px-8">
          <div className="relative z-10 mx-auto max-w-2xl text-center">
            <h1 className="font-heading text-6xl leading-[0.95] tracking-tight sm:text-7xl lg:text-8xl">
              Where your ideas <br className="hidden sm:block" />
              <em>take shape</em>.
            </h1>
            <p className="mx-auto mt-6 max-w-md text-base text-muted-foreground">
              Pin images, notes and colors on one board, and keep the colors you like in a palette.
            </p>
            <div className="mt-9 flex flex-col items-center gap-3">
              <a
                href="/board/"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-soft transition-transform outline-none hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
              >
                Start a board
              </a>
              <span className="text-xs text-muted-foreground">No account needed. Boards are saved in your browser.</span>
            </div>
          </div>
          <Board />
        </main>
      </div>

      <section className="px-4 py-24 sm:px-8">
        <div className="mx-auto grid max-w-5xl items-center gap-12 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-heading text-5xl leading-none">
              That board, <em>as tokens</em>.
            </h2>
            <p className="mt-5 max-w-sm text-muted-foreground">
              Rename and pin the colors you keep, and Lino turns them into tokens you can paste into your project. Fonts will
              come from the pages you link.
            </p>
            <p className="mt-6 font-mono text-xs text-muted-foreground">Export and link reading ship in the next release.</p>
          </div>
          <Output />
        </div>
      </section>

      <footer className="px-4 pb-6 sm:px-8">
        <div className="mx-auto max-w-5xl rounded-3xl bg-card px-6 py-10 shadow-soft sm:px-10">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <Logo />
            <a href="/board/" className={`${pill} self-start border border-border px-5 py-2.5 text-sm font-medium hover:bg-foreground hover:text-background sm:self-auto`}>
              Start a board
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} strokeWidth={2} />
            </a>
          </div>
          <p className="mt-10 border-t border-border/60 pt-5 text-xs text-muted-foreground">© {new Date().getFullYear()} Lino</p>
        </div>
      </footer>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Landing />
  </StrictMode>,
)
