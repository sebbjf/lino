import { PaintBrush02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { boardFonts, buildPalette } from './colors.ts'
import { cropBox, FULL } from './crop.ts'
import { boundsOf } from './geometry.ts'
import { toggleLock } from './selection.ts'
import { useBoard, type StylePatch } from './store.ts'
import { CORNERS, DECOS, FAMILY, GOOGLE_FONTS, MIN_OPACITY, NOTE_ALIGNS, NOTE_FONTS, NOTE_SIZES, PATTERNS, STICKY_COLORS, loadFamily, loadFontPreviews, DEFAULT_DUO, IMAGE_FILTERS, type Pattern } from './style.ts'

const NAMES: Record<string, string> = {
  square: 'Square',
  soft: 'Soft',
  round: 'Round',
  sm: 'S',
  md: 'M',
  lg: 'L',
  xl: 'XL',
  left: 'Left',
  center: 'Center',
  right: 'Right',
  sans: 'Sans',
  serif: 'Serif',
  dots: 'Dots',
  grid: 'Grid',
  plain: 'Plain',
  none: 'None',
  mono: 'Mono',
  duotone: 'Duotone',
  tape: 'Tape',
  pin: 'Pin',
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      {children}
    </fieldset>
  )
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: readonly T[]; value: T | undefined; onChange: (v: T) => void }) {
  return (
    <Group label={label}>
      <div className="flex gap-1">
        {options.map((o) => (
          <Button
            key={o}
            variant={value === o ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={value === o}
            className={`flex-1 ${value === o ? 'ring-1 ring-ring' : ''}`}
            onClick={() => onChange(o)}
          >
            {NAMES[o]}
          </Button>
        ))}
      </div>
    </Group>
  )
}

/** "Default", the board palette and a custom color well. `onStart` runs before a change so it undoes as one step. */
function Swatches({ label, value, onChange, onStart, presets = [] }: { label: string; value: string | undefined; onChange: (hex: string | undefined) => void; onStart?: () => void; presets?: string[] }) {
  const elements = useBoard((s) => s.elements)
  const colorMeta = useBoard((s) => s.colorMeta)
  const palette = useMemo(() => buildPalette(elements, colorMeta).colors.slice(0, 10), [elements, colorMeta])
  const ring = (on: boolean) => (on ? 'ring-2 ring-ring ring-offset-2 ring-offset-popover' : '')

  return (
    <Group label={label}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-pressed={!value}
          aria-label="Default"
          title="Default"
          className={`size-7 rounded-full border bg-[linear-gradient(135deg,var(--card)_45%,var(--border)_45%,var(--border)_55%,var(--card)_55%)] ${ring(!value)}`}
          onClick={() => {
            onStart?.()
            onChange(undefined)
          }}
        />
        {[...presets.map((hex) => ({ hex, name: 'Sticky' })), ...palette].map((c, i) => (
          <button
            key={`${i}-${c.hex}`}
            type="button"
            aria-pressed={value === c.hex}
            aria-label={`${c.name} ${c.hex}`}
            title={`${c.name} ${c.hex}`}
            className={`size-7 rounded-full border ${ring(value === c.hex)}`}
            style={{ background: c.hex }}
            onClick={() => {
              onStart?.()
              onChange(c.hex)
            }}
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" title="Custom color">
          <span className="sr-only">Custom color</span>
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={value ?? '#ffffff'}
            onClick={onStart}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    </Group>
  )
}

/** Search the curated Google Fonts, or type any family name Google Fonts has. */
function FontPicker({ value, onPick }: { value: string | undefined; onPick: (family: string) => void }) {
  const [q, setQ] = useState('')
  useEffect(loadFontPreviews, [])
  const query = q.trim()
  const shown = GOOGLE_FONTS.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
  const custom = query && FAMILY.test(query) && !GOOGLE_FONTS.some((f) => f.toLowerCase() === query.toLowerCase())
  return (
    <Group label="Google Fonts">
      <Input aria-label="Search Google Fonts" placeholder="Search or type any family…" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
      <div className="flex flex-wrap gap-0.5">
        {shown.map((f) => (
          <Button
            key={f}
            variant={value === f ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={value === f}
            className={`h-7 px-2 ${value === f ? 'ring-1 ring-ring' : ''}`}
            style={{ fontFamily: `"${f}", var(--font-sans)` }}
            onClick={() => onPick(f)}
          >
            {f}
          </Button>
        ))}
        {custom && (
          <Button variant="outline" size="sm" onClick={() => onPick(query)}>
            Use “{query}” from Google Fonts
          </Button>
        )}
        {!shown.length && !custom && <p className="px-2 py-1 text-xs text-muted-foreground">No match. Letters, numbers and spaces only.</p>}
      </div>
    </Group>
  )
}

function Toggle({ label, on, onClick, children }: { label: string; on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button variant={on ? 'secondary' : 'ghost'} size="sm" aria-label={label} aria-pressed={on} className={`flex-1 ${on ? 'ring-1 ring-ring' : ''}`} onClick={onClick}>
      {children}
    </Button>
  )
}

function ElementPanel({ ids, wide }: { ids: string[]; wide: boolean }) {
  const elements = useBoard((s) => s.elements)
  const copied = useBoard((s) => s.copiedStyle)
  const { copyStyle, pasteStyle } = useBoard.getState()
  const { restyle, checkpoint, step, update, setCropId } = useBoard.getState()
  const sel = elements.filter((e) => ids.includes(e.id))
  // controls show the most recently picked element's values
  const cur = sel.find((e) => e.id === ids.at(-1)) ?? sel[0]
  if (!cur) return null
  const note = cur.type === 'note' ? cur : null
  const allNotes = sel.every((e) => e.type === 'note')
  const image = cur.type === 'image' ? cur : null
  const allImages = sel.every((e) => e.type === 'image')
  const duo = image?.duo ?? DEFAULT_DUO
  const setDuo = (i: 0 | 1, hex: string | undefined) => {
    const next: [string, string] = [...duo]
    next[i] = hex ?? DEFAULT_DUO[i]
    restyle(ids, { duo: next })
  }
  const apply = (patch: StylePatch) => {
    checkpoint()
    restyle(ids, patch)
  }
  const allLocked = sel.every((e) => e.locked)
  const resetCrop = () => image?.crop && step(() => update(image.id, { ...cropBox(image, image.crop!, FULL, { x: image.flipX, y: image.flipY }), crop: undefined }))
  const opacity = Math.round((cur.opacity ?? 1) * 100)
  const fonts = boardFonts(elements).filter((f) => FAMILY.test(f))

  return (
    // columns only in the wide panel; a mixed selection has the narrow one, and columns there would squeeze the controls together
    <div className={`flex flex-col gap-3 ${wide ? 'sm:block sm:columns-2 sm:gap-x-6 lg:columns-3 sm:[&>*]:mb-3 sm:[&>*]:break-inside-avoid' : ''}`}>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" aria-keyshortcuts="Control+Alt+C" title="Ctrl+Alt+C" onClick={() => copyStyle(cur.id)}>
          Copy style
        </Button>
        <Button variant="outline" size="sm" className="flex-1" aria-keyshortcuts="Control+Alt+V" title="Ctrl+Alt+V" disabled={!copied} onClick={() => pasteStyle(ids)}>
          Paste style
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Lock</span>
        <Button variant="outline" size="sm" aria-label="Lock" aria-pressed={allLocked} onClick={() => toggleLock(ids)}>
          {allLocked ? 'Locked' : 'Unlocked'}
        </Button>
      </div>
      <Choice label="Corners" options={CORNERS} value={cur.corner ?? 'soft'} onChange={(corner) => apply({ corner })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Shadow</span>
        <Button variant="outline" size="sm" aria-label="Shadow" aria-pressed={cur.shadow !== false} onClick={() => apply({ shadow: cur.shadow === false })}>
          {cur.shadow === false ? 'Off' : 'On'}
        </Button>
      </div>
      <Choice label="Decoration" options={['none', ...DECOS] as const} value={cur.deco ?? 'none'} onChange={(d) => apply({ deco: d === 'none' ? undefined : d })} />
      <Group label={`Opacity ${opacity}%`}>
        <input
          type="range"
          aria-label="Opacity"
          min={MIN_OPACITY * 100}
          max={100}
          step={5}
          value={opacity}
          className="w-full accent-primary"
          onPointerDown={() => checkpoint()}
          onKeyDown={() => checkpoint()}
          onChange={(e) => restyle(ids, { opacity: Number(e.target.value) / 100 })}
        />
      </Group>
      {allImages && image && (
        <>
          <Choice
            label="Filter"
            options={['none', ...IMAGE_FILTERS] as const}
            value={image.filter ?? 'none'}
            onChange={(f) => apply({ filter: f === 'none' ? undefined : f, ...(f === 'duotone' && { duo }) })}
          />
          <Group label="Palette">
            <Toggle label="Use colors in palette" on={!image.paletteOff} onClick={() => apply({ paletteOff: image.paletteOff ? undefined : true })}>
              Use colors in palette
            </Toggle>
          </Group>
          <Group label="Flip">
            <div className="flex gap-1">
              <Toggle label="Flip horizontally" on={!!image.flipX} onClick={() => apply({ flipX: image.flipX ? undefined : true })}>
                Horizontal
              </Toggle>
              <Toggle label="Flip vertically" on={!!image.flipY} onClick={() => apply({ flipY: image.flipY ? undefined : true })}>
                Vertical
              </Toggle>
            </div>
          </Group>
          {ids.length === 1 && (
            <Group label="Crop">
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1" disabled={!!image.locked} onClick={() => setCropId(image.id)}>
                  Crop
                </Button>
                <Button variant="outline" size="sm" className="flex-1" disabled={!image.crop || !!image.locked} onClick={resetCrop}>
                  Reset crop
                </Button>
              </div>
            </Group>
          )}
          {image.filter === 'duotone' && (
            <>
              <Swatches label="Shadows" value={duo[0]} onStart={checkpoint} onChange={(hex) => setDuo(0, hex)} />
              <Swatches label="Highlights" value={duo[1]} onStart={checkpoint} onChange={(hex) => setDuo(1, hex)} />
            </>
          )}
        </>
      )}
      {allNotes && note && (
        <>
          <Swatches label="Note color" value={note.bg} presets={STICKY_COLORS} onStart={checkpoint} onChange={(bg) => restyle(ids, { bg })} />
          <Swatches label="Text color" value={note.color} onStart={checkpoint} onChange={(color) => restyle(ids, { color })} />
          <Group label="Heading">
            <Toggle label="Heading: large text, no card" on={!!note.heading} onClick={() => apply({ heading: note.heading ? undefined : true })}>
              <span className="font-semibold">H</span>
            </Toggle>
          </Group>
          {!note.heading && <Choice label="Text size" options={NOTE_SIZES} value={note.size ?? 'md'} onChange={(size) => apply({ size })} />}
          <Choice label="Align" options={NOTE_ALIGNS} value={note.align ?? 'left'} onChange={(align) => apply({ align })} />
          <Group label="Emphasis">
            <div className="flex gap-1">
              <Toggle label="Bold" on={!!note.bold} onClick={() => apply({ bold: note.bold ? undefined : true })}>
                <span className="font-bold">B</span>
              </Toggle>
              <Toggle label="Italic" on={!!note.italic} onClick={() => apply({ italic: note.italic ? undefined : true })}>
                <span className="italic">I</span>
              </Toggle>
            </div>
          </Group>
          <Choice label="Typeface" options={NOTE_FONTS} value={note.family ? undefined : (note.font ?? 'sans')} onChange={(font) => apply({ font, family: undefined })} />
          <FontPicker value={note.family} onPick={(family) => apply({ family })} />
          {fonts.length > 0 && (
            <Group label="Fonts from your links">
              <div className="flex flex-wrap gap-1">
                {fonts.map((f) => (
                  <Button
                    key={f}
                    variant={note.family === f ? 'secondary' : 'ghost'}
                    size="sm"
                    aria-pressed={note.family === f}
                    className={note.family === f ? 'ring-1 ring-ring' : undefined}
                    style={{ fontFamily: `"${f}", var(--font-sans)` }}
                    onPointerEnter={() => loadFamily(f)}
                    onFocus={() => loadFamily(f)}
                    onClick={() => apply({ family: f })}
                  >
                    {f}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Loaded from Google Fonts when it has them; otherwise the default font shows.</p>
            </Group>
          )}
        </>
      )}
    </div>
  )
}

/** One-click board looks: a background and a pattern. */
const THEMES: { name: string; bg?: string; pattern: Pattern }[] = [
  { name: 'Default', pattern: 'dots' },
  { name: 'Paper', bg: '#f4efe6', pattern: 'dots' },
  { name: 'Kraft', bg: '#c9a87c', pattern: 'plain' },
  { name: 'Night', bg: '#1c1f26', pattern: 'dots' },
  { name: 'Blueprint', bg: '#1e3a5f', pattern: 'grid' },
]

function BoardPanel() {
  const board = useBoard((s) => s.board)
  const { setBoard } = useBoard.getState()
  return (
    <>
      <Group label="Themes">
        <div className="grid grid-cols-5 gap-1.5">
          {THEMES.map((t) => {
            const on = board.bg === t.bg && (board.pattern ?? 'dots') === t.pattern
            return (
              <button
                key={t.name}
                type="button"
                aria-pressed={on}
                title={t.name}
                className={`flex flex-col items-center gap-1 rounded-lg p-1 text-[11px] ${on ? 'ring-2 ring-ring' : 'hover:bg-muted'}`}
                onClick={() => setBoard({ bg: t.bg, pattern: t.pattern })}
              >
                <span aria-hidden className="size-8 rounded-md border" style={{ background: t.bg ?? 'var(--background)' }} />
                {t.name}
              </button>
            )
          })}
        </div>
      </Group>
      <Swatches label="Background" value={board.bg} onChange={(bg) => setBoard({ bg })} />
      <Choice label="Pattern" options={PATTERNS} value={board.pattern ?? 'dots'} onChange={(pattern) => setBoard({ pattern })} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-muted-foreground">Messy mode: new things land slightly tilted</span>
        <Button variant="outline" size="sm" aria-label="Messy mode" aria-pressed={!!board.messy} onClick={() => setBoard({ messy: !board.messy })}>
          {board.messy ? 'On' : 'Off'}
        </Button>
      </div>
    </>
  )
}

/** If the open panel covers the selection, pans the view so the selection sits in the largest free area beside it. */
function revealSelection() {
  const panel = [...document.querySelectorAll<HTMLElement>('[data-slot=popover-content]')].find((p) => p.textContent?.startsWith('Style'))
  const { selectedIds, elements, view } = useBoard.getState()
  const sel = elements.filter((e) => selectedIds.includes(e.id))
  if (!panel || !sel.length) return
  const P = panel.getBoundingClientRect()
  const b = boundsOf(sel)
  const S = { x: b.x * view.zoom + view.x, y: b.y * view.zoom + view.y, w: b.w * view.zoom, h: b.h * view.zoom }
  const m = 16
  if (S.x + S.w < P.left - m || S.x > P.right + m || S.y + S.h < P.top - m || S.y > P.bottom + m) return
  // free areas: above the panel and either side of it (keeping clear of the top-left logo row)
  const top = 64
  const areas = [
    { x: 0, y: top, w: innerWidth, h: P.top - top - m },
    { x: 0, y: top, w: P.left - m, h: innerHeight - top },
    { x: P.right + m, y: top, w: innerWidth - P.right - m, h: innerHeight - top },
  ].filter((a) => a.w > 0 && a.h > 0)
  const best = areas.sort((a, c) => c.w * c.h - a.w * a.h)[0]
  if (!best) return
  glideTo({ x: view.x + best.x + best.w / 2 - (S.x + S.w / 2), y: view.y + best.y + best.h / 2 - (S.y + S.h / 2) })
}

/** Moves the view to `to` with an ease-out instead of a jump. Any other change to the view (a pan, a zoom) cancels it. */
function glideTo(to: { x: number; y: number }, ms = 320) {
  const { view: from, setView } = useBoard.getState()
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView({ ...from, ...to })
  const t0 = performance.now()
  let last = from
  const frame = (now: number) => {
    if (useBoard.getState().view !== last) return // the user moved the view meanwhile
    const t = Math.min(1, (now - t0) / ms)
    const e = 1 - (1 - t) ** 3
    last = { ...from, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }
    setView(last)
    if (t < 1) requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

/** Style of the selected elements, or of the board when nothing is selected. */
export function StyleMenu() {
  const ids = useBoard((s) => s.selectedIds)
  const [open, setOpen] = useState(false)
  const elements = useBoard((s) => s.elements)
  // notes and images have a second column of their own options, so the panel is wider and grows sideways instead of scrolling
  const sel = elements.filter((e) => ids.includes(e.id))
  const wide = sel.length > 0 && (sel.every((e) => e.type === 'note') || sel.every((e) => e.type === 'image'))
  const target = ids.length ? (ids.length === 1 ? 'element' : `${ids.length} elements`) : 'board'

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        // once the panel is laid out, move the selection out from under it
        if (o) setTimeout(revealSelection, 150)
      }}
    >
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Style the ${target}`} />} />}>
          <HugeiconsIcon icon={PaintBrush02Icon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>Style the {target}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className={`w-72 gap-3 p-4 max-h-(--available-height) overflow-y-auto ${wide ? 'sm:w-[40rem] lg:w-[58rem] max-w-[calc(100vw-2rem)]' : ''}`}>
        <p className="text-lg font-semibold tracking-tight">{ids.length ? 'Style' : 'Board'}</p>
        {ids.length ? <ElementPanel ids={ids} wide={wide} /> : <BoardPanel />}
      </PopoverContent>
    </Popover>
  )
}
