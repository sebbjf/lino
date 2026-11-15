import {
  Copy01Icon,
  Delete02Icon,
  Download04Icon,
  Image01Icon,
  LayerBringForwardIcon,
  LayerSendBackwardIcon,
  MinusSignIcon,
  PaintBoardIcon,
  PlusSignIcon,
  RedoIcon,
  StickyNote01Icon,
  SwatchIcon,
  UndoIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { zoomAt } from './geometry.ts'
import { addImages } from './image.ts'
import { downloadPng } from './png.ts'
import { ShareButton } from './ShareButton.tsx'
import { useBoard } from './store.ts'

type ToolProps = { label: string; icon: IconSvgElement; onClick: () => void; shortcut?: string; disabled?: boolean; pressed?: boolean }

/** shortcut is written for display ("Ctrl+Z"); aria-keyshortcuts wants "Control+Z". */
function Tool({ label, icon, onClick, shortcut, disabled, pressed }: ToolProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-keyshortcuts={shortcut?.replace('Ctrl', 'Control')}
            aria-pressed={pressed}
            className={pressed ? 'bg-muted' : undefined}
            disabled={disabled}
            onClick={onClick}
          />
        }
      >
        <HugeiconsIcon icon={icon} strokeWidth={1.8} />
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

const Divider = () => <Separator orientation="vertical" className="mx-1 h-5 self-center" />

export function Toolbar({ paletteOpen, onTogglePalette }: { paletteOpen: boolean; onTogglePalette: () => void }) {
  const selectedId = useBoard((s) => s.selectedId)
  const zoom = useBoard((s) => s.view.zoom)
  const canUndo = useBoard((s) => s.past.some((p) => p !== s.elements))
  const canRedo = useBoard((s) => s.future.length > 0)
  const readOnly = useBoard((s) => s.readOnly)
  const empty = useBoard((s) => s.elements.length === 0)
  const { add, duplicate, reorder, remove, undo, redo } = useBoard.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const zoomTo = (z: number) => {
    const { view, setView } = useBoard.getState()
    setView(zoomAt(view, window.innerWidth / 2, window.innerHeight / 2, z))
  }

  return (
    <div
      role="toolbar"
      aria-label="Board tools"
      className="fixed bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border bg-card/90 p-1.5 [scrollbar-width:none] shadow-soft backdrop-blur"
    >
      {!readOnly && (
        <>
          <Tool label="Add image" icon={Image01Icon} onClick={() => fileInput.current?.click()} />
          <Tool label="Add note" icon={StickyNote01Icon} onClick={() => add({ type: 'note', text: '', w: 220, h: 140 })} />
          <Tool label="Add color" icon={PaintBoardIcon} onClick={() => add({ type: 'color', hex: '#d6c7b4', w: 140, h: 140 })} />
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              addImages([...(e.target.files ?? [])])
              e.target.value = ''
            }}
          />

          <Divider />
          <Tool label="Undo" icon={UndoIcon} shortcut="Ctrl+Z" disabled={!canUndo} onClick={undo} />
          <Tool label="Redo" icon={RedoIcon} shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={redo} />

          {selectedId && (
            <>
              <Divider />
              <Tool label="Duplicate" icon={Copy01Icon} shortcut="Ctrl+D" onClick={() => duplicate(selectedId)} />
              <Tool label="Bring forward" icon={LayerBringForwardIcon} shortcut="]" onClick={() => reorder(selectedId, 'forward')} />
              <Tool label="Send backward" icon={LayerSendBackwardIcon} shortcut="[" onClick={() => reorder(selectedId, 'backward')} />
              <Tool label="Delete" icon={Delete02Icon} shortcut="Delete" onClick={() => remove(selectedId)} />
            </>
          )}

          <Divider />
        </>
      )}

      <Tool label="Zoom out" icon={MinusSignIcon} onClick={() => zoomTo(zoom / 1.25)} />
      <Button variant="ghost" size="sm" aria-label="Reset zoom to 100%" className="tabular-nums" onClick={() => zoomTo(1)}>
        {Math.round(zoom * 100)}%
      </Button>
      <Tool label="Zoom in" icon={PlusSignIcon} onClick={() => zoomTo(zoom * 1.25)} />

      <Divider />
      <Tool label="Palette" icon={SwatchIcon} pressed={paletteOpen} onClick={onTogglePalette} />
      <Tool label="Download PNG" icon={Download04Icon} disabled={empty} onClick={downloadPng} />
      {!readOnly && <ShareButton />}
    </div>
  )
}
