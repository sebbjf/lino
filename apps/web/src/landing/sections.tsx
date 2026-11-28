import { useRef, type ReactNode } from 'react'
import { Add01Icon, AdvertisimentIcon, CookieIcon, LaptopIcon, UserBlock01Icon, ViewOffSlashIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { motion, type MotionValue, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { darkButton, ease, Arrow, Photo, Eyebrow, Reveal, Line, section, container, h2, lead } from './ui.tsx'

// ---------------------------------------------------------------- statement
// one big sentence that lights up word by word as it scrolls past, with photos set into the line.
// Progress runs from the sentence entering at 80% of the viewport to its center reaching mid-screen, so the last word lights exactly there.
export const statement: (string | { src: string })[] = [
  'Keep', 'whatever', 'catches', 'your', 'eye:', { src: 'metal' }, 'a', 'sculpture,', { src: 'strokes' }, 'a', 'brushstroke,',
  { src: 'sunflowers' }, 'a', 'bouquet,', 'all', 'on', 'one', 'board.',
]

export function Word({ p, range, children }: { p: MotionValue<number>; range: [number, number]; children: ReactNode }) {
  const reduced = useReducedMotion()
  const opacity = useTransform(p, range, reduced ? [1, 1] : [0.12, 1])
  return (
    <motion.span className="mr-[0.22em] inline-block" style={{ opacity }}>
      {children}
    </motion.span>
  )
}

export function StatementSection() {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'center center'] })
  const n = statement.length
  return (
    <section className={section}>
      <p ref={ref} className={`${container} text-[clamp(2rem,4.6vw,4.25rem)] leading-[1.15] font-semibold tracking-[-0.045em] text-balance`}>
        {statement.map((w, i) => (
          <Word key={i} p={scrollYProgress} range={[i / n, (i + 1) / n]}>
            {typeof w === 'string' ? (
              w
            ) : (
              <img src={`/landing/${w.src}.jpg`} alt="" className="inline-block h-[0.9em] w-[1.7em] rounded-full object-cover align-[-0.1em]" />
            )}
          </Word>
        ))}
      </p>
    </section>
  )
}

// ---------------------------------------------------------------- privacy
export const promises = [
  { label: 'No account', note: 'Open the board and start pinning.', icon: UserBlock01Icon },
  { label: 'No tracking', note: 'No analytics. Images and notes stay in your browser.', icon: ViewOffSlashIcon },
  { label: 'No cookies', note: 'Nothing to accept before you start.', icon: CookieIcon },
  { label: 'No ads', note: 'Just your board.', icon: AdvertisimentIcon },
]

// a small board on "this device": four of the hero's photos, pinned loosely
export const privatePhotos = [
  { src: 'beach', className: 'left-[7%] top-[7%] w-[28%] aspect-[2/3] -rotate-3' },
  { src: 'tulips', className: 'left-[39%] top-[5%] w-[24%] aspect-[3/4] rotate-2' },
  { src: 'painting', className: 'left-[65%] top-[30%] w-[29%] aspect-[4/3] -rotate-2' },
  { src: 'kintsugi', className: 'left-[40%] top-[50%] w-[22%] aspect-[3/4] rotate-3' },
]

export function PrivacySection() {
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
export const faqs = [
  ['Where are my boards saved?', "In your browser's storage on this device. Images and notes never leave it unless you share the board. A pasted link is the exception: its address goes to Lino's server, which reads the page for you."],
  ['What happens if I clear my browser data?', 'The copy in your browser is deleted with it. Save the board as a .lino.json file first to keep a copy on your disk you can open later, or download it as a PNG.'],
  ['Can I open a board on another device?', 'Save the board as a .lino.json file and open it there. Or share a read-only link: it is a fixed copy that lasts 90 days.'],
  ['Does Lino work offline?', 'Yes, once you install the board from your browser. Everything works without a connection except reading pasted links and sharing.'],
  ['How do I use the palette in my project?', 'Open the palette and copy it as CSS variables or a Tailwind v4 theme, in hex or OKLCH. Fonts read from your links come along.'],
  ['Do I need an account?', 'No. Open the board and start pinning.'],
]

export function FaqSection() {
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
export const ctaPhotos = ['vases', 'metal', 'sunflowers', 'yellow', 'plant']

export function CtaSection() {
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

/** Wordmark with overlapping dots, in the page's own neutrals. */
export function Logo() {
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
      <span aria-hidden className="flex -space-x-1.5">
        {['bg-foreground/15', 'bg-foreground/35', 'bg-foreground/60', 'bg-foreground'].map((c) => (
          <span key={c} className={`size-3.5 rounded-full ring-2 ring-background ${c}`} />
        ))}
      </span>
      <span className="text-xl leading-none font-semibold tracking-tight">Lino</span>
    </a>
  )
}

export const footerLinks = [
  { title: 'Product', links: [['Open your board', '/board/'], ['How it works', '#how-it-works']] },
  { title: 'Lino', links: [['Docs', '/docs/'], ['Privacy', '/privacy/'], ['Questions', '#faq']] },
]

export function Footer() {
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
