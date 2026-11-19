import { Settings02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { setSetting, useSettings, type Settings } from './settings.ts'

function Choice<K extends keyof Settings>({ label, name, options }: { label: string; name: K; options: [Settings[K], string][] }) {
  const value = useSettings((s) => s[name])
  return (
    <div className="flex items-center justify-between gap-4">
      <span>{label}</span>
      <div role="group" aria-label={label} className="flex gap-1">
        {options.map(([v, text]) => (
          <Button key={text} size="sm" variant={v === value ? 'secondary' : 'ghost'} aria-pressed={v === value} onClick={() => setSetting(name, v)}>
            {text}
          </Button>
        ))}
      </div>
    </div>
  )
}

const mb = (bytes: number) => (bytes < 1e6 ? `${Math.max(1, Math.round(bytes / 1e3))} KB` : `${(bytes / 1e6).toFixed(1)} MB`)

/** Storage this site uses in the browser: boards and their images. */
function Usage() {
  const [used, setUsed] = useState<number>()
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsed(e.usage), () => {})
  }, [])
  return <p className="text-muted-foreground">{used === undefined ? 'Boards are stored in this browser.' : `Boards and images use ${mb(used)} in this browser.`}</p>
}

/** App-wide preferences of this device; they never travel with a board. */
export function SettingsMenu() {
  const open = useSettings((s) => s.open)
  const setOpen = (o: boolean) => useSettings.setState({ open: o })
  return (
    <>
      <Tooltip>
        <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Settings" className="rounded-full border bg-card/90 shadow-soft backdrop-blur" onClick={() => setOpen(true)} />}>
          <HugeiconsIcon icon={Settings02Icon} strokeWidth={1.8} />
        </TooltipTrigger>
        <TooltipContent>Settings</TooltipContent>
      </Tooltip>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Saved in this browser, for every board.</DialogDescription>
          <Choice label="Theme" name="theme" options={[['system', 'System'], ['light', 'Light'], ['dark', 'Dark']]} />
          <Choice label="Snap and guides while dragging" name="snap" options={[[true, 'On'], [false, 'Off']]} />
          <p className="-mb-2 text-xs font-medium text-muted-foreground">New boards start with</p>
          <Choice label="Background" name="newPattern" options={[['dots', 'Dots'], ['grid', 'Grid'], ['plain', 'Plain']]} />
          <Choice label="Messy mode" name="newMessy" options={[[false, 'Off'], [true, 'On']]} />
          <Usage />
        </DialogContent>
      </Dialog>
    </>
  )
}
