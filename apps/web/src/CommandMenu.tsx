import { Fragment, useEffect, useState, type KeyboardEvent } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { available, commands, groupOf, iconOf, search } from './commands.ts'

/** Ctrl/Cmd+K (or Ctrl/Cmd+/, as in Figma): type to find any board action, Enter runs it. Works from a text field too. */
export function CommandMenu({ open, setOpen }: { open: boolean; setOpen: (o: boolean | ((o: boolean) => boolean)) => void }) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // every opening starts with an empty search, whether from the keys or the toolbar button
  useEffect(() => {
    setQuery('')
    setActive(0)
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key.toLowerCase() === 'k' || e.key === '/')) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setOpen])

  // the list is read when the menu opens or the query changes: the board cannot change under an open dialog
  const results = open ? search(available(commands), query) : []

  const run = (i: number) => {
    const c = results[i]
    if (!c) return
    setOpen(false)
    c.run()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const n = results.length
      if (n) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : -1) + n) % n)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-auto bottom-24 max-sm:bottom-40 max-w-lg translate-y-0 gap-1 rounded-[1.75rem] p-2">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} strokeWidth={1.8} className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-10 rounded-2xl border-0 pl-9"
          autoFocus
          role="combobox"
          aria-expanded
          aria-controls="command-list"
          aria-activedescendant={results[active] && `cmd-${results[active].id}`}
          aria-label="Search commands"
          placeholder="Type a command…"
          value={query}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
        />
        </div>
        <ul id="command-list" role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto">
          {results.map((c, i) => (
            <Fragment key={c.id}>
            {!query && groupOf(c) !== groupOf(results[i - 1] ?? c) || (!query && i === 0) ? (
              <li role="presentation" className="px-3 pt-2 pb-1 text-xs font-medium text-muted-foreground">{groupOf(c)}</li>
            ) : null}
            <li
              id={`cmd-${c.id}`}
              role="option"
              aria-selected={i === active}
              ref={(el) => {
                if (i === active) el?.scrollIntoView({ block: 'nearest' })
              }}
              className={`flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 ${i === active ? 'bg-muted' : ''}`}
              onMouseMove={() => setActive(i)}
              onClick={() => run(i)}
            >
              <span className="flex items-center gap-3">
                <HugeiconsIcon icon={iconOf(c)} strokeWidth={1.8} className="size-4 text-muted-foreground" />
                {c.label}
              </span>
              {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
            </li>
            </Fragment>
          ))}
          {!results.length && <li className="px-3 py-2 text-muted-foreground">No matching command</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
