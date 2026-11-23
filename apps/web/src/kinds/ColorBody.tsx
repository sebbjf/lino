import type { RefObject } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ColorFields } from '../ColorFields.tsx'
import { harmonies } from '../colors.ts'
import { useBoard, type BoardElement } from '../store.ts'
import { surface } from '../style.ts'

type Color = Extract<BoardElement, { type: 'color' }>

/** Hue-rotated companions of a swatch; clicking one adds it as a new swatch beside this one. */
function Harmonies({ el }: { el: Color }) {
  const add = (hex: string, i: number) =>
    useBoard.getState().add({ type: 'color', hex, w: el.w, h: el.h }, { x: el.x + el.w * 1.5 + 16 + i * (el.w + 16), y: el.y + el.h / 2 })
  return (
    <div className="mt-3 flex flex-col gap-2 border-t pt-3">
      <p className="text-xs font-medium text-muted-foreground">Harmonies: click to add</p>
      {harmonies(el.hex).map((g) => (
        <div key={g.name} className="flex items-center justify-between gap-2">
          <span className="text-xs">{g.name}</span>
          <span className="flex gap-1">
            {g.colors.map((hex, i) => (
              <button
                key={hex + i}
                type="button"
                aria-label={`Add ${g.name.toLowerCase()} color ${hex}`}
                title={hex}
                className="size-6 rounded-full border"
                style={{ background: hex }}
                onClick={() => add(hex, i)}
              />
            ))}
          </span>
        </div>
      ))}
    </div>
  )
}

type Props = { el: Color; root: RefObject<HTMLDivElement | null>; pickerOpen: boolean; setPickerOpen: (v: boolean) => void }

/** A swatch with its hex chip; the chip opens the picker. `root` is the element's own div, which keeps keyboard focus. */
export function ColorBody({ el, root, pickerOpen, setPickerOpen }: Props) {
  const { update, select, checkpoint } = useBoard.getState()
  const readOnly = useBoard((s) => s.readOnly)
  return (
    <div className="relative size-full rounded-2xl shadow-soft" style={{ ...surface(el), background: el.hex }}>
      <Popover
        open={pickerOpen && !readOnly}
        onOpenChange={(open) => {
          if (open) checkpoint()
          setPickerOpen(open)
        }}
      >
        <PopoverTrigger
          aria-label={`Edit color ${el.hex}`}
          className="absolute bottom-2 left-2 cursor-pointer rounded-full bg-card/90 px-2 py-0.5 font-mono text-xs text-card-foreground pointer-coarse:px-3 pointer-coarse:py-1.5"
          tabIndex={-1}
          onPointerDown={(e) => {
            // keep focus (and keyboard shortcuts) on the element itself; Enter opens the picker for keyboard users
            e.stopPropagation()
            e.preventDefault()
            select(el.id)
            root.current!.focus({ preventScroll: true })
          }}
        >
          {el.hex}
        </PopoverTrigger>
        <PopoverContent side="right" align="start" className="w-60" finalFocus={root}>
          <ColorFields hex={el.hex} onChange={(hex) => update(el.id, { hex })} />
          <Harmonies el={el} />
        </PopoverContent>
      </Popover>
    </div>
  )
}
