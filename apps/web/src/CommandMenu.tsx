import { useEffect, useState, type KeyboardEvent } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import { available, commands, search } from './commands.ts'

/** Ctrl/Cmd+K: type to find any board action, Enter runs it. Works from a text field too. */
export function CommandMenu() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent | globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
        setQuery('')
        setActive(0)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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
      <DialogContent className="top-[20%] max-w-md translate-y-0 gap-2 p-3">
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <Input
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
        <ul id="command-list" role="listbox" aria-label="Commands" className="max-h-72 overflow-y-auto">
          {results.map((c, i) => (
            <li
              key={c.id}
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
              {c.label}
              {c.shortcut && <Kbd>{c.shortcut}</Kbd>}
            </li>
          ))}
          {!results.length && <li className="px-3 py-2 text-muted-foreground">No matching command</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
