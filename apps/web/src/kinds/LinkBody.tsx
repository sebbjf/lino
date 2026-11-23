import { Alert02Icon, Link01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useImageSrc } from '../data/images.ts'
import type { BoardElement } from '../board/store.ts'
import { surface } from '../board/style.ts'
import { CARD_PAD, LINK_DOT, LINK_DOT_GAP } from './look.ts'

type Link = Extract<BoardElement, { type: 'link' }>

export function LinkBody({ el }: { el: Link }) {
  const cover = useImageSrc(el.image)
  const host = new URL(el.url).hostname.replace(/^www\./, '')
  // a missing cover is visible already
  const missing = el.missing.filter((m) => m !== 'image')

  return (
    <div className="flex size-full flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-soft" style={surface(el)}>
      {cover && <img src={cover} alt="" draggable={false} className="pointer-events-none min-h-0 flex-1 object-cover" />}
      <div className="flex shrink-0 flex-col gap-2" style={{ padding: CARD_PAD }}>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Link01Icon} size={14} strokeWidth={1.8} />
          {/* the one-click way to open it; double click and Enter on the card do the same */}
          <a
            href={el.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            draggable={false}
            className="truncate underline-offset-4 hover:underline"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {host}
          </a>
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
            <p className="line-clamp-2 text-lg leading-snug font-semibold tracking-tight">{el.title ?? host}</p>
            {(el.fonts.length > 0 || el.colors.length > 0) && (
              <div className="flex flex-wrap items-center" style={{ gap: LINK_DOT_GAP }}>
                {el.colors.map((hex) => (
                  <span key={hex} title={hex} className="rounded-full border" style={{ background: hex, width: LINK_DOT, height: LINK_DOT }} />
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
