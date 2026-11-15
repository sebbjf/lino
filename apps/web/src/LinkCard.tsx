import { Alert02Icon, Link01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { BoardElement } from './store.ts'
import { surface } from './style.ts'

type Link = Extract<BoardElement, { type: 'link' }>

export function LinkCard({ el }: { el: Link }) {
  const host = new URL(el.url).hostname.replace(/^www\./, '')
  // a missing cover is visible already
  const missing = el.missing.filter((m) => m !== 'image')

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-soft" style={surface(el)}>
      {el.image && <img src={el.image} alt="" draggable={false} className="pointer-events-none min-h-0 flex-1 object-cover" />}
      <div className="flex shrink-0 flex-col gap-2 p-4">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={1.8} />
          <span className="truncate">{host}</span>
        </p>

        {el.status === 'loading' && (
          <p className="animate-pulse text-sm text-muted-foreground motion-reduce:animate-none">Reading the page…</p>
        )}

        {el.status === 'error' && (
          <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
            <HugeiconsIcon icon={Alert02Icon} size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
            {el.error}
          </p>
        )}

        {el.status === 'ok' && (
          <>
            <p className="line-clamp-2 font-heading text-lg leading-snug">{el.title ?? host}</p>
            {(el.fonts.length > 0 || el.colors.length > 0) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {el.colors.map((hex) => (
                  <span key={hex} title={hex} className="size-4 rounded-full border" style={{ background: hex }} />
                ))}
                {el.fonts.map((f) => (
                  <span key={f} title="Read from the page's CSS; may be incomplete" className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {f}
                  </span>
                ))}
              </div>
            )}
            {missing.length > 0 && <p className="text-xs text-muted-foreground">Not found: {missing.join(', ')}</p>}
          </>
        )}
      </div>
    </div>
  )
}
