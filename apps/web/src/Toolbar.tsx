import {
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignHorizontalCenterIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalCenterIcon,
  AlignVerticalSpaceBetweenIcon,
  Copy01Icon,
  Delete02Icon,
  Image01Icon,
  LayerBringForwardIcon,
  LayerSendBackwardIcon,
  MinusSignIcon,
  PaintBoardIcon,
  PipetteIcon,
  PlusSignIcon,
  RedoIcon,
  StickyNote01Icon,
  SwatchIcon,
  UndoIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useRef, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeHex } from './colors.ts'
import { zoomAt } from './geometry.ts'
import { addImages } from './image.ts'
import { FileMenu } from './FileMenu.tsx'
import { ShareButton } from './ShareButton.tsx'
import { StyleMenu } from './StyleMenu.tsx'
import { useBoard } from './store.ts'

// Chromium only for now; elsewhere the button is hidden.
type EyeDropperCtor = new () => { open: () => Promise<{ sRGBHex: string }> }
const EyeDropper = (window as unknown as { EyeDropper?: EyeDropperCtor }).EyeDropper

/** Picks any pixel on screen (an image, a link cover) and pins it to the palette. */
async function pickColor() {
  const { setColorMeta, notify } = useBoard.getState()
  try {
    const hex = normalizeHex((await new EyeDropper!().open()).sRGBHex)
    if (!hex) return
    setColorMeta(hex, { pinned: true, hidden: false })
    notify(`${hex} added to the palette.`)
  } catch {
    // Esc cancels the picker; nothing to say
  }
}

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

/** Left/Right (and Home/End) move between toolbar buttons, as the toolbar role promises. */
function moveFocus(e: KeyboardEvent<HTMLDivElement>) {
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
  if (!keys.includes(e.key)) return
  const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  const i = items.indexOf(document.activeElement as HTMLButtonElement)
  if (i < 0) return
  const next = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: items.length - 1 }[e.key]!
  items[(next + items.length) % items.length].focus()
  e.preventDefault()
}

const Divider = () => <Separator orientation="vertical" className="mx-1 h-5 self-center" />

export function Toolbar({ paletteOpen, onTogglePalette }: { paletteOpen: boolean; onTogglePalette: () => void }) {
  const selectedIds = useBoard((s) => s.selectedIds)
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const zoom = useBoard((s) => s.view.zoom)
  const canUndo = useBoard((s) => s.past.some((p) => p !== s.elements))
  const canRedo = useBoard((s) => s.future.length > 0)
  const readOnly = useBoard((s) => s.readOnly)
  const { add, duplicate, reorder, remove, undo, redo, align, distribute } = useBoard.getState()
  const fileInput = useRef<HTMLInputElement>(null)

  const zoomTo = (z: number) => {
    const { view, setView } = useBoard.getState()
    setView(zoomAt(view, window.innerWidth / 2, window.innerHeight / 2, z))
  }

  return (
    <div
      role="toolbar"
      aria-label="Board tools"
      onKeyDown={moveFocus}
      className="fixed bottom-6 left-1/2 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-full border bg-card/90 p-1.5 [scrollbar-width:none] shadow-soft backdrop-blur"
    >
      {!readOnly && (
        <>
          <Tool label="Add image" icon={Image01Icon} onClick={() => fileInput.current?.click()} />
          <Tool label="Add note" icon={StickyNote01Icon} onClick={() => add({ type: 'note', text: '', w: 220, h: 140 })} />
          <Tool label="Add color" icon={PaintBoardIcon} onClick={() => add({ type: 'color', hex: '#d6c7b4', w: 140, h: 140 })} />
          {EyeDropper && <Tool label="Pick a color from the screen" icon={PipetteIcon} onClick={pickColor} />}
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

          {selectedIds.length > 0 && (
            <>
              <Divider />
              <Tool label="Duplicate" icon={Copy01Icon} shortcut="Ctrl+D" onClick={() => duplicate(selectedIds)} />
              {selectedId && (
                <>
                  <Tool label="Bring forward" icon={LayerBringForwardIcon} shortcut="]" onClick={() => reorder(selectedId, 'forward')} />
                  <Tool label="Send backward" icon={LayerSendBackwardIcon} shortcut="[" onClick={() => reorder(selectedId, 'backward')} />
                </>
              )}
              <Tool label="Delete" icon={Delete02Icon} shortcut="Delete" onClick={() => remove(selectedIds)} />
            </>
          )}

          {selectedIds.length > 1 && (
            <>
              <Divider />
              <Tool label="Align left" icon={AlignStartVerticalIcon} onClick={() => align(selectedIds, 'left')} />
              <Tool label="Align centers horizontally" icon={AlignHorizontalCenterIcon} onClick={() => align(selectedIds, 'hcenter')} />
              <Tool label="Align right" icon={AlignEndVerticalIcon} onClick={() => align(selectedIds, 'right')} />
              <Tool label="Align top" icon={AlignStartHorizontalIcon} onClick={() => align(selectedIds, 'top')} />
              <Tool label="Align middles vertically" icon={AlignVerticalCenterIcon} onClick={() => align(selectedIds, 'vcenter')} />
              <Tool label="Align bottom" icon={AlignEndHorizontalIcon} onClick={() => align(selectedIds, 'bottom')} />
              {selectedIds.length > 2 && (
                <>
                  <Tool label="Distribute horizontally" icon={AlignHorizontalSpaceBetweenIcon} onClick={() => distribute(selectedIds, 'x')} />
                  <Tool label="Distribute vertically" icon={AlignVerticalSpaceBetweenIcon} onClick={() => distribute(selectedIds, 'y')} />
                </>
              )}
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
      {!readOnly && <StyleMenu />}
      <Tool label="Palette" icon={SwatchIcon} pressed={paletteOpen} onClick={onTogglePalette} />
      <FileMenu />
      {!readOnly && <ShareButton />}
    </div>
  )
}
