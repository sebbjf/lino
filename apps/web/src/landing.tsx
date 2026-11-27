import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Image02Icon, Link01Icon, StickyNote01Icon, SwatchIcon } from '@hugeicons/core-free-icons'
import { MotionConfig } from 'motion/react'
import { darkButton, Arrow, Tag, Reveal, Line } from './landing/ui.tsx'
import { Stage } from './landing/HeroStage.tsx'
import { DemoSection } from './landing/DemoSection.tsx'
import { StatementSection, PrivacySection, FaqSection, CtaSection, Logo, Footer } from './landing/sections.tsx'
import './index.css'

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
          className="pointer-events-none relative z-10 mx-auto max-w-4xl text-center"
        >
          {/* the text steps back behind an arranged stage; the button stays readable, it is still the way in */}
          <h1 className={`transition-opacity duration-700 ${arranged ? 'opacity-15' : ''} text-[clamp(2.75rem,6vw,5.5rem)] leading-[0.98] font-semibold tracking-[-0.055em]`}>
            <Line delay={0.05}>Your references,</Line>
            <Line delay={0.18}>
              <span className="text-foreground/45">on one board.</span>
            </Line>
          </h1>
          <Reveal delay={0.35}>
            <p className={`mx-auto mt-8 max-w-md text-base leading-8 text-muted-foreground transition-opacity duration-700 ${arranged ? 'opacity-15' : ''}`}>
              Pin <Tag icon={Image02Icon} color="var(--p-teal)">images</Tag>, <Tag icon={Link01Icon} color="#7c6bd6">links</Tag>, <Tag icon={StickyNote01Icon} color="#d9a21b">notes</Tag> and <Tag icon={SwatchIcon} color="var(--p-orange)">colors</Tag>, and keep the colors you like in a palette.
            </p>
          </Reveal>
          <Reveal delay={0.45} className="mt-8 flex flex-col items-center gap-4 lg:mt-10">
            <a
              href="/board/"
              className="pointer-events-auto rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background shadow-soft transition-[translate,scale] outline-none hover:-translate-y-0.5 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none"
            >
              Start a board
            </a>
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
      <StatementSection />
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
