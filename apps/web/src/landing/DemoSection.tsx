import { useRef, useState } from 'react'
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ROLES, palette, v, dots, PALETTE_CSS, useMedia, Photo, Eyebrow, Line, container, lead } from './ui.tsx'

// ---------------------------------------------------------------- demo
// demo timeline, in ticks: each photo, then each palette row, then the code lines
export const AT = { photo: 1, row: 6, code: 11, end: 26 }
export const STEPS = [
  { at: AT.photo, label: 'Pin your references' },
  { at: AT.row, label: 'Colors land in the palette' },
  { at: AT.code, label: 'The palette becomes tokens' },
]

export const pop = (on: boolean) =>
  `transition-[opacity,translate,scale] duration-500 ease-out motion-reduce:transition-none ${on ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-90'}`

export const demoPhotos = [
  { src: 'lantern', className: 'top-[9%] left-[5%] h-40 w-[107px] sm:h-56 sm:w-[149px]', rotate: '-4deg' },
  { src: 'chair', className: 'top-[20%] left-[33%] h-32 w-[85px] sm:h-48 sm:w-32', rotate: '3deg' },
  { src: 'teapot', className: 'top-[7%] left-[58%] h-20 w-[120px] sm:h-28 sm:w-[168px]', rotate: '5deg' },
  { src: 'plant', className: 'top-[46%] left-[62%] h-32 w-[94px] sm:h-44 sm:w-[129px]', rotate: '-6deg' },
]

/** The real flow, played by the scroll: pin things, the palette fills, the tokens appear. */
export function DemoBoard({ t }: { t: number }) {
  const codeLines = PALETTE_CSS.split('\n')
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
export function DemoSection() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const pinned = useMedia('(min-width: 1024px) and (min-height: 700px)') && !reduced
  const { scrollYProgress } = useScroll({ target: ref, offset: pinned ? ['start start', 'end end'] : ['start 0.9', 'end 0.6'] })
  const [t, setT] = useState(reduced ? AT.end : 0)
  useMotionValueEvent(scrollYProgress, 'change', (p) => !reduced && setT(Math.round(Math.min(1, p / 0.9) * AT.end)))
  const bar = useTransform(scrollYProgress, [0, 0.9], ['0%', '100%'])
  return (
    <section ref={ref} id="how-it-works" className={`px-4 sm:px-8 ${pinned ? 'h-[220vh]' : 'py-24 sm:py-36'}`}>
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
