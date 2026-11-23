import {
  Cards02Icon,
  DashboardCircleIcon,
  FlowerIcon,
  GridTableIcon,
  GridViewIcon,
  ImageCompositionIcon,
  LayoutGridIcon,
  LayoutTwoColumnIcon,
  LayoutTwoRowIcon,
  MagicWand01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { command, selectedKind } from './commands.ts'
import { LAYOUTS, type Layout } from './geometry.ts'
import { useBoard } from './store.ts'

const INFO: Record<Layout, { label: string; hint: string; icon: IconSvgElement }> = {
  grid: { label: 'Grid', hint: 'Even rows and columns', icon: GridViewIcon },
  masonry: { label: 'Masonry', hint: 'Columns, no gaps, like a pinboard', icon: LayoutGridIcon },
  row: { label: 'Row', hint: 'One line, centers aligned', icon: LayoutTwoColumnIcon },
  column: { label: 'Column', hint: 'One stack, centers aligned', icon: LayoutTwoRowIcon },
  circle: { label: 'Circle', hint: 'A ring around the middle', icon: DashboardCircleIcon },
  sunflower: { label: 'Sunflower', hint: 'A spiral of seeds, the biggest in the middle', icon: FlowerIcon },
  fan: { label: 'Fan', hint: 'Spread out like a hand of cards', icon: Cards02Icon },
  collage: { label: 'Collage', hint: 'Overlapping and tilted, like photos on a table', icon: ImageCompositionIcon },
  mosaic: { label: 'Mosaic', hint: 'Staggered rows that overlap, like prints on a wall', icon: GridTableIcon },
}
const PLAYFUL: Layout[] = ['sunflower', 'fan', 'collage', 'mosaic']

/** Layout templates for the selection (2+), or the whole board when nothing is selected. */
export function ArrangeMenu() {
  const selectedIds = useBoard((s) => s.selectedIds)
  const count = useBoard((s) => s.elements.length)
  const [open, setOpen] = useState(false)
  // one frame selected: its contents are arranged inside it
  const inFrame = useBoard((s) => selectedKind(s) === 'frame')
  const whole = selectedIds.length < 2 && !inFrame
  const target = inFrame ? 'frame contents' : whole ? 'board' : `${selectedIds.length} selected`
  // disabled, not hidden: the toolbar keeps its shape
  const disabled = !inFrame && ((whole && count < 2) || selectedIds.length === 1)

  const run = (mode: Layout) => {
    command(`layout-${mode}`).run()
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Arrange the ${target}`} disabled={disabled} />} />}>
          <HugeiconsIcon icon={MagicWand01Icon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>Arrange the {target}</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className="max-h-(--available-height) w-72 gap-1 overflow-y-auto p-2">
        <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground">Arrange the {target} (Ctrl+Z undoes)</p>
        {LAYOUTS.map((mode) => (
          <div key={mode} className="contents">
            {mode === PLAYFUL[0] && <p className="mt-1 border-t px-3 pt-3 pb-1 text-xs text-muted-foreground">Playful</p>}
            <Button variant="ghost" className="h-auto justify-start gap-3 rounded-xl px-3 py-2 text-left whitespace-normal" onClick={() => run(mode)}>
              <HugeiconsIcon icon={INFO[mode].icon} strokeWidth={1.8} />
              <span className="flex flex-col">
                <span>{INFO[mode].label}</span>
                <span className="text-xs font-normal text-muted-foreground">{INFO[mode].hint}</span>
              </span>
            </Button>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
