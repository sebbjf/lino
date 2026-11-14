import { Cancel01Icon, PinIcon, PinOffIcon, SwatchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { buildPalette } from './colors.ts'
import { useBoard } from './store.ts'

export function PalettePanel({ onClose }: { onClose: () => void }) {
  const elements = useBoard((s) => s.elements)
  const colorMeta = useBoard((s) => s.colorMeta)
  const { setColorMeta, restoreHiddenColors } = useBoard.getState()
  const { colors, hidden } = useMemo(() => buildPalette(elements, colorMeta), [elements, colorMeta])

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
            <EmptyDescription>Add a color swatch to the board and it shows up here.</EmptyDescription>
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

      {hidden.length > 0 && (
        <Button variant="link" size="sm" className="self-start px-0" onClick={restoreHiddenColors}>
          Restore {hidden.length} removed {hidden.length === 1 ? 'color' : 'colors'}
        </Button>
      )}
    </aside>
  )
}
