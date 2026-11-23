import { AddSquareIcon, Link01Icon, PipetteIcon, Search01Icon, SwatchIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useShallow } from 'zustand/react/shallow'
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { normalizeHex } from './colors.ts'
import { fitAll, zoomTo } from './viewport.ts'
import { command, commands, enabled, iconOf } from './commands.ts'
import { addLink, asUrl } from './link.ts'
import { FileMenu } from './FileMenu.tsx'
import { ShareButton } from './ShareButton.tsx'
import { StyleMenu } from './StyleMenu.tsx'
import { ArrangeMenu } from './ArrangeMenu.tsx'
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

/** Less common things to add: a heading, a frame, a whole folder of images. */
function AddMenu() {
  const [open, setOpen] = useState(false)
  const items: [string, string][] = [['Heading', 'add-heading'], ['Frame', 'add-frame'], ['Import folder', 'import-folder']]
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="More to add" />} />}>
          <HugeiconsIcon icon={AddSquareIcon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>More to add</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className="w-52 gap-1 p-2">
        {items.map(([label, id]) => (
          <Button
            key={id}
            variant="ghost"
            className="justify-start gap-3 rounded-xl px-3"
            onClick={() => {
              setOpen(false)
              command(id).run()
            }}
          >
            <HugeiconsIcon icon={iconOf(command(id))} strokeWidth={1.8} />
            {label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

// the selection bar's buttons, in sections separated by dividers; each shows while its command applies
const SELECTION_SECTIONS = [
  ['duplicate', 'forward', 'backward', 'frame-selection', 'group', 'ungroup', 'swatches'],
  commands.filter((c) => /^(align|distribute)-/.test(c.id)).map((c) => c.id),
  ['delete'],
]

/** A button for a registered command: label, icon and shortcut come from commands.ts. */
function CommandTool({ id, disabled }: { id: string; disabled?: boolean }) {
  const c = command(id)
  return <Tool label={c.label} icon={iconOf(c)} shortcut={c.shortcut} disabled={disabled} onClick={() => c.run()} />
}

/** What you can do with the selection; floats over the main bar and only exists while something is selected. */
function SelectionBar() {
  const n = useBoard((s) => s.selectedIds.length)
  const shown = useBoard(useShallow((s) => SELECTION_SECTIONS.flat().filter((id) => enabled(command(id), s))))
  if (!n) return null

  return (
    <div
      role="toolbar"
      aria-label="Selection tools"
      onKeyDown={moveFocus}
      className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-[1.75rem] border bg-card/90 p-1.5 shadow-soft backdrop-blur"
    >
      {SELECTION_SECTIONS.map((ids) => ids.filter((id) => shown.includes(id)))
        .filter((ids) => ids.length)
        .map((ids, i) => (
          <div key={ids[0]} className="contents">
            {i > 0 && <Divider />}
            {ids.map((id) => (
              <CommandTool key={id} id={id} />
            ))}
          </div>
        ))}
    </div>
  )
}

export function Toolbar({ paletteOpen, onTogglePalette, onOpenCommands }: { paletteOpen: boolean; onTogglePalette: () => void; onOpenCommands: () => void }) {
  const zoom = useBoard((s) => s.view.zoom)
  const canUndo = useBoard(hasUndo)
  const canRedo = useBoard((s) => s.future.length > 0)
  const readOnly = useBoard((s) => s.readOnly)

  return (
    <div className="fixed bottom-6 left-1/2 flex w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col items-center gap-2">
    {!readOnly && <SelectionBar />}
    <div
      id="board-tools"
      tabIndex={-1}
      role="toolbar"
      aria-label="Board tools"
      onKeyDown={moveFocus}
      // wraps onto more rows when the window is narrow, instead of scrolling sideways with no scrollbar: every tool stays in reach
      className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-[1.75rem] border bg-card/90 p-1.5 shadow-soft backdrop-blur outline-none"
    >
      {!readOnly && (
        <>
          <CommandTool id="add-image" />
          <LinkTool />
          <CommandTool id="add-note" />
          <CommandTool id="add-color" />
          {EyeDropper && <Tool label="Pick a color from the screen" icon={PipetteIcon} onClick={pickColor} />}
          <AddMenu />

          <Divider />
          <CommandTool id="undo" disabled={!canUndo} />
          <CommandTool id="redo" disabled={!canRedo} />

          <Divider />
        </>
      )}

      <CommandTool id="zoom-out" />
      <Button variant="ghost" size="sm" aria-label={`Zoom ${Math.round(zoom * 100)}%. Reset to 100%, double click to fit the board`} className="tabular-nums" onClick={() => zoomTo(1)} onDoubleClick={fitAll}>
        {Math.round(zoom * 100)}%
      </Button>
      <CommandTool id="zoom-in" />

      <Divider />
      {!readOnly && <ArrangeMenu />}
      {!readOnly && <StyleMenu />}
      <Tool label="Commands" icon={Search01Icon} shortcut="Ctrl+K" onClick={onOpenCommands} />
      <Tool label="Palette" icon={SwatchIcon} pressed={paletteOpen} onClick={onTogglePalette} />
      <FileMenu />
      {!readOnly && <ShareButton />}
    </div>
    </div>
  )
}
