import { FileExportIcon, FileImportIcon, Folder01Icon, Image02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { exportBoardFile, importBoardFile } from './boardFile.ts'
import { downloadPng } from './png.ts'
import { useBoard } from './store.ts'

function Item({ icon, label, hint, onClick, disabled }: { icon: IconSvgElement; label: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button variant="ghost" className="h-auto justify-start gap-3 rounded-xl px-3 py-2 text-left whitespace-normal" disabled={disabled} onClick={onClick}>
      <HugeiconsIcon icon={icon} strokeWidth={1.8} />
      <span className="flex flex-col">
        <span>{label}</span>
        <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </span>
    </Button>
  )
}

/** Board file in and out: a .lino.json that round-trips everything, and a PNG to look at. */
export function FileMenu() {
  const empty = useBoard((s) => s.elements.length === 0)
  const readOnly = useBoard((s) => s.readOnly)
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="File: import and export" title="Import and export" />}>
        <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.8} />
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={12} className="w-72 gap-1 p-2">
        <Item icon={FileExportIcon} label="Export board" hint="A .lino.json file with everything on it" disabled={empty} onClick={run(exportBoardFile)} />
        {!readOnly && (
          <Item icon={FileImportIcon} label="Import board…" hint="Replaces this board (undo brings it back)" onClick={run(() => input.current?.click())} />
        )}
        <Item icon={Image02Icon} label="Download PNG" hint="An image of the whole board" disabled={empty} onClick={run(downloadPng)} />
      </PopoverContent>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) importBoardFile(file)
          e.target.value = ''
        }}
      />
    </Popover>
  )
}
