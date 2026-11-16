import { Share08Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { shareBoard } from './share.ts'
import { useBoard } from './store.ts'

type State = { step: 'idle' | 'busy' } | { step: 'done'; url: string; expiresAt: string } | { step: 'error'; error: string }

/** Uploads only when the user confirms: the copy leaves the browser. */
export function ShareButton() {
  const empty = useBoard((s) => s.elements.length === 0)
  const [state, setState] = useState<State>({ step: 'idle' })
  const [copied, setCopied] = useState(false)
  // what was on the board when the link was made, and the field that shows it
  const shared = useRef<unknown>(null)
  const field = useRef<HTMLInputElement>(null)

  const create = async () => {
    setState({ step: 'busy' })
    shared.current = useBoard.getState().elements
    try {
      setState({ step: 'done', ...(await shareBoard()) })
    } catch (e) {
      setState({ step: 'error', error: (e as Error).message })
    }
  }

  const copy = async (url: string) => {
    // no clipboard access: leave the link selected so it can be copied by hand
    await navigator.clipboard.writeText(url).then(() => setCopied(true), () => field.current?.select())
  }

  return (
    <Popover
      onOpenChange={(open) => {
        // each share is a new snapshot of the board as it is now; an unchanged board keeps the link it already has
        if (open && !(state.step === 'done' && shared.current === useBoard.getState().elements)) setState({ step: 'idle' })
        setCopied(false)
      }}
    >
      <PopoverTrigger render={<Button variant="ghost" size="sm" disabled={empty} />}>
        <HugeiconsIcon icon={Share08Icon} strokeWidth={1.8} />
        Share
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={12} className="w-80">
        <PopoverHeader>
          <PopoverTitle>Share a read-only link</PopoverTitle>
          <PopoverDescription>
            Uploads a copy of the board as it is now. Later changes are not included. Anyone with the link can view it for 90 days; it cannot be deleted earlier.
          </PopoverDescription>
        </PopoverHeader>
        {state.step === 'done' ? (
          <div className="flex gap-2">
            <Input ref={field} readOnly value={state.url} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={() => copy(state.url)}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
        ) : (
          <Button onClick={create} disabled={state.step === 'busy'}>
            {state.step === 'busy' ? 'Creating link…' : 'Create link'}
          </Button>
        )}
        {state.step === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
