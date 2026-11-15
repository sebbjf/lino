import { PaintBrush02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { boardFonts, buildPalette } from './colors.ts'
import { useBoard, type StylePatch } from './store.ts'
import { CORNERS, DECOS, FAMILY, MIN_OPACITY, NOTE_FONTS, NOTE_SIZES, PATTERNS, loadFamily, DEFAULT_DUO, IMAGE_FILTERS, type Pattern } from './style.ts'

const NAMES: Record<string, string> = {
  square: 'Square',
  soft: 'Soft',
  round: 'Round',
  sm: 'S',
  md: 'M',
  lg: 'L',
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
function Swatches({ label, value, onChange, onStart }: { label: string; value: string | undefined; onChange: (hex: string | undefined) => void; onStart?: () => void }) {
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
        {palette.map((c) => (
          <button
            key={c.hex}
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

function ElementPanel({ ids }: { ids: string[] }) {
  const elements = useBoard((s) => s.elements)
  const copied = useBoard((s) => s.copiedStyle)
  const { copyStyle, pasteStyle } = useBoard.getState()
  const { restyle, checkpoint } = useBoard.getState()
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
  const opacity = Math.round((cur.opacity ?? 1) * 100)
  const fonts = boardFonts(elements).filter((f) => FAMILY.test(f))

  return (
    <>
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="flex-1" aria-keyshortcuts="Control+Alt+C" title="Ctrl+Alt+C" onClick={() => copyStyle(cur.id)}>
          Copy style
        </Button>
        <Button variant="outline" size="sm" className="flex-1" aria-keyshortcuts="Control+Alt+V" title="Ctrl+Alt+V" disabled={!copied} onClick={() => pasteStyle(ids)}>
          Paste style
        </Button>
      </div>
      <Choice label="Corners" options={CORNERS} value={cur.corner ?? 'soft'} onChange={(corner) => apply({ corner })} />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Shadow</span>
        <Button variant="outline" size="sm" aria-pressed={cur.shadow !== false} onClick={() => apply({ shadow: cur.shadow === false })}>
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
          onPointerDown={checkpoint}
          onKeyDown={checkpoint}
          onChange={(e) => restyle(ids, { opacity: Number(e.target.value) / 100 })}
        />
      </Group>
      {allImages && image && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <Choice
            label="Filter"
            options={['none', ...IMAGE_FILTERS] as const}
            value={image.filter ?? 'none'}
            onChange={(f) => apply({ filter: f === 'none' ? undefined : f, ...(f === 'duotone' && { duo }) })}
          />
          {image.filter === 'duotone' && (
            <>
              <Swatches label="Shadows" value={duo[0]} onStart={checkpoint} onChange={(hex) => setDuo(0, hex)} />
              <Swatches label="Highlights" value={duo[1]} onStart={checkpoint} onChange={(hex) => setDuo(1, hex)} />
            </>
          )}
        </div>
      )}
      {allNotes && note && (
        <div className="flex flex-col gap-3 border-t pt-3">
          <Swatches label="Note color" value={note.bg} onStart={checkpoint} onChange={(bg) => restyle(ids, { bg })} />
          <Choice label="Text size" options={NOTE_SIZES} value={note.size ?? 'md'} onChange={(size) => apply({ size })} />
          <Choice label="Typeface" options={NOTE_FONTS} value={note.family ? undefined : (note.font ?? 'sans')} onChange={(font) => apply({ font, family: undefined })} />
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
        </div>
      )}
    </>
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
        <Button variant="outline" size="sm" aria-pressed={!!board.messy} onClick={() => setBoard({ messy: !board.messy })}>
          {board.messy ? 'On' : 'Off'}
        </Button>
      </div>
    </>
  )
}

/** Style of the selected elements, or of the board when nothing is selected. */
export function StyleMenu() {
  const ids = useBoard((s) => s.selectedIds)
  const [open, setOpen] = useState(false)
  const target = ids.length ? (ids.length === 1 ? 'element' : `${ids.length} elements`) : 'board'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Style the ${target}`} title={`Style the ${target}`} />}>
        <HugeiconsIcon icon={PaintBrush02Icon} strokeWidth={1.8} />
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={12} className="w-72 gap-3 p-4">
        <p className="text-lg font-semibold tracking-tight">{ids.length ? 'Style' : 'Board'}</p>
        {ids.length ? <ElementPanel ids={ids} /> : <BoardPanel />}
      </PopoverContent>
    </Popover>
  )
}
