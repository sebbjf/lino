import { useEffect, useRef, useState, type ReactNode } from 'react'
import { animate, motion, MotionConfig, useMotionValue, useSpring, useTransform, useVelocity } from 'motion/react'
import { ARRANGE, arrange, START, startAt, stageSize, type Item, type Mode } from './stage.ts'
import { pill, useSize, useMedia, Photo } from './ui.tsx'

// ---------------------------------------------------------------- hero board
export type Limits = { left: number; right: number; top: number; bottom: number }

/** One photo on the hero board: thrown with momentum, tilts with its speed, springs into layouts. */
export function Piece({ item, limits, delay, onFront, onSettle }: {
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

export function ToolButton({ pressed, onClick, children }: { pressed?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`${pill} px-2 py-1.5 text-[13px] text-foreground/70 sm:px-3 sm:text-sm hover:bg-foreground/[0.06] hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background`}
    >
      {children}
    </button>
  )
}

export type StageProps = { onArranged: (on: boolean) => void }

/**
 * Wide screens: the stage fills the hero behind the headline, photos start around it, and the toolbar
 * floats at the bottom. Narrower: a block under the text that starts as a collage, toolbar below.
 */
export function Stage({ onArranged }: StageProps) {
  const outer = useRef<HTMLDivElement>(null)
  const fill = useMedia('(min-width: 1024px)')
  const { w: width, h: height } = useSize(outer)
  const { W, H, Hu, k } = stageSize(fill, width, height)

  const [items, setItems] = useState<Item[]>([])
  const [mode, setModeState] = useState<Mode>('original')
  const setMode = (m: Mode) => {
    setModeState(m)
    // the headline only fades when photos sit behind it (full screen); on narrow screens the stage is below the text
    onArranged(fill && m !== 'original' && m !== 'scatter')
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
    <div className={fill ? 'pointer-events-none absolute inset-0 z-0' : 'relative mt-6'}>
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
          className="grid grid-cols-3 items-center justify-items-center gap-0.5 rounded-3xl sm:flex sm:flex-wrap sm:justify-center sm:rounded-full border border-border/70 bg-card/90 p-1.5 shadow-soft backdrop-blur"
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
