import { Cancel01Icon, Copy01Icon, PinIcon, PinOffIcon, SwatchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { boardFonts, buildPalette, shuffledOrder } from './colors.ts'
import { exportTheme, slug, type ExportFormat } from './export.ts'
import { useBoard } from './store.ts'

export function PalettePanel({ onClose }: { onClose: () => void }) {
  const elements = useBoard((s) => s.elements)
  const colorMeta = useBoard((s) => s.colorMeta)
  const { setColorMeta, restoreHiddenColors, notify } = useBoard.getState()
  const { colors, hidden } = useMemo(() => buildPalette(elements, colorMeta), [elements, colorMeta])
  const fonts = useMemo(() => boardFonts(elements), [elements])

  const prefs = useBoard((s) => s.exportPrefs)
  const { setExportPrefs } = useBoard.getState()
  const [format, setFormat] = useState<ExportFormat>('css')
  const code = exportTheme(format, colors, fonts, prefs)
  const copy = () =>
    navigator.clipboard.writeText(code).then(
      () => notify(format === 'css' ? 'CSS variables copied.' : 'Tailwind theme copied.'),
      () => notify('Could not copy to the clipboard.'),
    )

  return (
    <aside
      aria-labelledby="palette-title"
      className="fixed right-4 top-4 flex max-h-[calc(100dvh-7rem)] w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-3xl border bg-card p-4 shadow-soft"
    >
      <header className="flex items-center justify-between">
        <h2 id="palette-title" className="font-heading text-2xl">
          Palette
        </h2>
        <Button variant="ghost" size="icon-sm" aria-label="Close palette" onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.8} />
        </Button>
      </header>

      {colors.length === 0 ? (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={SwatchIcon} strokeWidth={1.8} />
            </EmptyMedia>
            <EmptyTitle>No colors yet</EmptyTitle>
            <EmptyDescription>Add a color swatch or paste a link and its colors show up here.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul className="flex flex-col gap-1">
          {colors.map((c) => (
            <li key={c.hex} className="flex items-center gap-2">
              <span aria-hidden className="size-8 shrink-0 rounded-full border" style={{ background: c.hex }} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Input
                  aria-label={`Name for ${c.hex}`}
                  className="h-7 border-transparent bg-transparent px-1.5 shadow-none hover:border-border"
                  value={colorMeta[c.hex]?.name ?? ''}
                  placeholder={c.name}
                  spellCheck={false}
                  onChange={(e) => setColorMeta(c.hex, { name: e.target.value })}
                />
                <span className="px-1.5 font-mono text-xs text-muted-foreground">{c.hex}</span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={c.pinned ? `Unpin ${c.name}` : `Pin ${c.name}`}
                aria-pressed={c.pinned}
                title={c.pinned ? 'Unpin' : 'Pin: keep it even if the swatch is deleted'}
                onClick={() => setColorMeta(c.hex, { pinned: !c.pinned })}
              >
                <HugeiconsIcon icon={c.pinned ? PinOffIcon : PinIcon} strokeWidth={1.8} />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${c.name} from palette`}
                title="Remove from palette"
                onClick={() => setColorMeta(c.hex, { hidden: true, pinned: false })}
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={1.8} />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {colors.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          title="Shuffle the order (pinned colors stay first); unnamed colors get new numbers"
          onClick={() => {
            for (const [hex, order] of Object.entries(shuffledOrder(colors.map((c) => c.hex)))) setColorMeta(hex, { order })
          }}
        >
          Shuffle order
        </Button>
      )}

      {hidden.length > 0 && (
        <Button variant="link" size="sm" className="self-start px-0" onClick={restoreHiddenColors}>
          Restore {hidden.length} removed {hidden.length === 1 ? 'color' : 'colors'}
        </Button>
      )}

      {fonts.length > 0 && (
        <section aria-labelledby="fonts-title" className="flex flex-col gap-2 border-t pt-3">
          <h3 id="fonts-title" className="font-heading text-lg">
            Fonts
          </h3>
          <ul className="flex flex-wrap gap-1.5">
            {fonts.map((f) => (
              <li key={f} className="rounded-full bg-muted px-2.5 py-0.5 text-sm">
                {f}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Read from the links' CSS, so the list may be incomplete.</p>
        </section>
      )}

      {(colors.length > 0 || fonts.length > 0) && (
        <section aria-label="Export" className="flex flex-col gap-2 border-t pt-3">
          <div className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs font-medium text-muted-foreground">
              Variable prefix
              <Input
                className="h-8 font-mono"
                placeholder="none"
                spellCheck={false}
                autoComplete="off"
                maxLength={30}
                value={prefs.prefix}
                onChange={(e) => setExportPrefs({ prefix: e.target.value })}
              />
            </label>
            <div role="group" aria-label="Color format" className="flex gap-1">
              {(['hex', 'oklch'] as const).map((f) => (
                <Button
                  key={f}
                  variant={prefs.format === f ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={prefs.format === f}
                  className={prefs.format === f ? 'ring-1 ring-ring' : undefined}
                  onClick={() => setExportPrefs({ format: f })}
                >
                  {f === 'hex' ? 'Hex' : 'OKLCH'}
                </Button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {slug(prefs.prefix, '') ? `CSS writes --${slug(prefs.prefix, '')}-color-…; ` : ''}Tailwind always uses --color-… so its classes work.
          </p>
          <div role="group" aria-label="Export as" className="flex gap-1">
            {(['css', 'tailwind'] as const).map((f) => (
              <Button
                key={f}
                variant={format === f ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={format === f}
                className={`flex-1 ${format === f ? 'ring-1 ring-ring' : ''}`}
                onClick={() => setFormat(f)}
              >
                {f === 'css' ? 'CSS variables' : 'Tailwind'}
              </Button>
            ))}
          </div>
          <pre
            aria-label={`${format === 'css' ? 'CSS' : 'Tailwind'} preview`}
            tabIndex={0}
            className="max-h-48 overflow-auto rounded-xl bg-muted p-3 font-mono text-xs leading-relaxed select-text"
          >
            {code}
          </pre>
          <Button variant="outline" size="sm" onClick={copy}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={1.8} data-icon="inline-start" />
            Copy {format === 'css' ? 'CSS' : 'Tailwind'}
          </Button>
        </section>
      )}
    </aside>
  )
}
