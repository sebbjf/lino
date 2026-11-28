import { FileExportIcon, FileImportIcon, Folder01Icon, Image02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { command, runCommand } from '../board/commands.ts'
import { supportsDiskFiles } from '../data/boardDisk.ts'
import { downloadPng } from '../data/png.ts'
import { useBoard } from '../board/store.ts'

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
  const diskFiles = supportsDiskFiles && !readOnly
  const run = (fn: () => void) => () => {
    setOpen(false)
    fn()
  }
  const fileItem = (id: string, icon: IconSvgElement, hint: string, disabled?: boolean) => (
    <Item icon={icon} label={command(id).label} hint={hint} disabled={disabled} onClick={run(() => runCommand(id))} />
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label="File" />} />}>
          <HugeiconsIcon icon={Folder01Icon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>File</TooltipContent>
      </Tooltip>
      <PopoverContent side="top" sideOffset={12} className="w-72 gap-1 p-2">
        {diskFiles ? (
          <>
            {fileItem('open', FileImportIcon, 'Open a .lino.json file')}
            {fileItem('save', FileExportIcon, 'Ctrl+S', empty)}
            {fileItem('save-as', FileExportIcon, 'Ctrl+Shift+S', empty)}
          </>
        ) : (
          <>
            {fileItem('export', FileExportIcon, 'A .lino.json file with everything on it', empty)}
            {!readOnly && fileItem('import', FileImportIcon, 'Open a .lino.json file')}
          </>
        )}
        <Item icon={Image02Icon} label="Download PNG" hint="An image of the whole board" disabled={empty} onClick={run(downloadPng)} />
      </PopoverContent>
    </Popover>
  )
}
