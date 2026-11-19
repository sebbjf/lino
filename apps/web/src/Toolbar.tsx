import {
  AlignEndHorizontalIcon,
  ArtboardToolIcon,
  FrameIcon,
  GroupItemsIcon,
  Heading01Icon,
  Layers01Icon,
  FolderUploadIcon,
  AlignEndVerticalIcon,
  AlignHorizontalCenterIcon,
  AlignHorizontalSpaceBetweenIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  AlignVerticalCenterIcon,
  AlignVerticalSpaceBetweenIcon,
  ColorsIcon,
  Copy01Icon,
  Delete02Icon,
  Image01Icon,
  Link01Icon,
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
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeHex } from './colors.ts'
import { fitView, zoomAt } from './geometry.ts'
import { addImages, imageColors } from './image.ts'
import { addLink, asUrl } from './link.ts'
import { FileMenu } from './FileMenu.tsx'
import { ShareButton } from './ShareButton.tsx'
import { StyleMenu } from './StyleMenu.tsx'
import { ArrangeMenu } from './ArrangeMenu.tsx'
import { duplicate, frameSelection, group, remove, reorder, ungroup } from './selection.ts'
import { hasUndo, useBoard } from './store.ts'

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

/** Pasting or dropping a URL works too, but a phone has no paste on the canvas and nothing hints at it. */
function LinkTool() {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [bad, setBad] = useState(false)
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = value.trim()
    const url = asUrl(text) ?? asUrl(`https://${text}`)
    if (!url) return setBad(true)
    addLink(url)
    setValue('')
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        setBad(false)
      }}
    >
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Add link" />} />}>
          <HugeiconsIcon icon={Link01Icon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>Add link</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className="w-80 max-w-[calc(100vw-2rem)]">
        <form className="flex gap-2" onSubmit={submit}>
          <Input
            autoFocus
            inputMode="url"
            autoCapitalize="none"
            aria-label="Link address"
            aria-invalid={bad}
            placeholder="https://…"
            value={value}
            maxLength={2048}
            onChange={(e) => {
              setValue(e.target.value)
              setBad(false)
            }}
          />
          <Button type="submit" disabled={!value.trim()}>
            Add
          </Button>
        </form>
        {bad && (
          <p role="alert" className="text-sm text-destructive">
            That does not look like a web address.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

// hidden on a phone: the bar wraps there, and a divider at the end of a row reads as a stray mark
const Divider = () => <Separator orientation="vertical" className="mx-1 h-5 self-center max-sm:hidden" />

export function Toolbar({ paletteOpen, onTogglePalette }: { paletteOpen: boolean; onTogglePalette: () => void }) {
  const selectedIds = useBoard((s) => s.selectedIds)
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null
  const zoom = useBoard((s) => s.view.zoom)
  const canUndo = useBoard(hasUndo)
  const canRedo = useBoard((s) => s.future.length > 0)
  const readOnly = useBoard((s) => s.readOnly)
  const { add, undo, redo, align, distribute } = useBoard.getState()
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const grouped = useBoard((s) => s.elements.some((e) => e.groupId && selectedIds.includes(e.id)))
  const imageSelected =useBoard((s) => s.elements.find((e) => e.id === selectedId)?.type === 'image')

  const swatchesFromImage = () => {
    const { elements, swatchRow, notify } = useBoard.getState()
    const el = elements.find((e) => e.id === selectedId)
    if (el?.type !== 'image') return
    imageColors(el.src).then(
      (hexes) => swatchRow(el.id, hexes),
      () => notify('Could not read the colors of that image.'),
    )
  }

  const zoomTo = (z: number) => {
    const { view, setView } = useBoard.getState()
    setView(zoomAt(view, window.innerWidth / 2, window.innerHeight / 2, z))
  }

  const fitAll = () => {
    const { elements, setView } = useBoard.getState()
    if (elements.length) setView(fitView(elements, innerWidth, innerHeight))
  }

  return (
    <div
      id="board-tools"
      tabIndex={-1}
      role="toolbar"
      aria-label="Board tools"
      onKeyDown={moveFocus}
      // wraps onto more rows when the window is narrow, instead of scrolling sideways with no scrollbar: every tool stays in reach
      className="fixed bottom-6 left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-0.5 rounded-[1.75rem] border bg-card/90 p-1.5 shadow-soft backdrop-blur outline-none"
    >
      {!readOnly && (
        <>
          <Tool label="Add image" icon={Image01Icon} onClick={() => fileInput.current?.click()} />
          <LinkTool />
          <Tool label="Add note" icon={StickyNote01Icon} onClick={() => add({ type: 'note', text: '', w: 220, h: 140 })} />
          <Tool label="Add heading" icon={Heading01Icon} onClick={() => add({ type: 'note', text: '', w: 480, h: 84, heading: true, bold: true })} />
          <Tool label="Add frame" icon={FrameIcon} onClick={() => add({ type: 'frame', title: '', w: 480, h: 320 })} />
          <Tool label="Add color" icon={PaintBoardIcon} onClick={() => add({ type: 'color', hex: '#d6c7b4', w: 140, h: 140 })} />
          {EyeDropper && <Tool label="Pick a color from the screen" icon={PipetteIcon} onClick={pickColor} />}
          <Tool label="Import folder" icon={FolderUploadIcon} onClick={() => folderInput.current?.click()} />
          <input
            ref={folderInput}
            type="file"
            // @ts-expect-error webkitdirectory is not in React's input typings
            webkitdirectory=""
            multiple
            hidden
            onChange={(e) => {
              addImages([...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/')))
              e.target.value = ''
            }}
          />
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

          {/* always there, disabled without a selection: the bar keeps its shape, so a second click never lands on another tool.
              A phone has no room for idle buttons, so there the group shows only while it has something to act on. */}
          <div className="contents max-sm:[&:not(:has(button:enabled))]:hidden">
            <Divider />
            <Tool label="Duplicate" icon={Copy01Icon} shortcut="Ctrl+D" disabled={!selectedIds.length} onClick={() => duplicate(selectedIds)} />
            <Tool label="Bring forward" icon={LayerBringForwardIcon} shortcut="]" disabled={!selectedId} onClick={() => selectedId && reorder(selectedId, 'forward')} />
            <Tool label="Send backward" icon={LayerSendBackwardIcon} shortcut="[" disabled={!selectedId} onClick={() => selectedId && reorder(selectedId, 'backward')} />
            <Tool label="Frame selection" icon={ArtboardToolIcon} shortcut="Ctrl+Alt+F" disabled={!selectedIds.length} onClick={() => frameSelection(selectedIds)} />
            <Tool label="Group" icon={GroupItemsIcon} shortcut="Ctrl+G" disabled={selectedIds.length < 2} onClick={() => group(selectedIds)} />
            <Tool label="Ungroup" icon={Layers01Icon} shortcut="Ctrl+Shift+G" disabled={!grouped} onClick={() => ungroup(selectedIds)} />
            <Tool label="Swatches from image" icon={ColorsIcon} disabled={!imageSelected} onClick={swatchesFromImage} />
            <Tool label="Delete" icon={Delete02Icon} shortcut="Delete" disabled={!selectedIds.length} onClick={() => remove(selectedIds)} />
          </div>

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
      <Button variant="ghost" size="sm" aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100%, double click to fit the board`} className="tabular-nums" onClick={() => zoomTo(1)} onDoubleClick={fitAll}>
        {Math.round(zoom * 100)}%
      </Button>
      <Tool label="Zoom in" icon={PlusSignIcon} onClick={() => zoomTo(zoom * 1.25)} />

      <Divider />
      {!readOnly && <ArrangeMenu />}
      {!readOnly && <StyleMenu />}
      <Tool label="Palette" icon={SwatchIcon} pressed={paletteOpen} onClick={onTogglePalette} />
      <FileMenu />
      {!readOnly && <ShareButton />}
    </div>
  )
}
