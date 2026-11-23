import { CropOverlay } from '../components/CropOverlay.tsx'
import { cropStyle } from '../board/crop.ts'
import { useImageSrc } from '../data/images.ts'
import type { BoardElement } from '../board/store.ts'
import { DEFAULT_DUO, rgb, surface } from '../board/style.ts'
import type { CropState } from './useCrop.ts'

type Image = Extract<BoardElement, { type: 'image' }>

/** SVG duotone: grey by luma, then map black to shadows and white to highlights (same math as filterPixels). */
function DuotoneFilter({ id, duo }: { id: string; duo: [string, string] }) {
  const [a, b] = duo.map((h) => rgb(h) ?? [0, 0, 0])
  const table = (c: number) => `${a[c] / 255} ${b[c] / 255}`
  return (
    <svg aria-hidden width="0" height="0" className="absolute">
      <filter id={`duo-${id}`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={table(0)} />
          <feFuncG type="table" tableValues={table(1)} />
          <feFuncB type="table" tableValues={table(2)} />
        </feComponentTransfer>
      </filter>
    </svg>
  )
}

export function ImageBody({ el, zoom, crop }: { el: Image; zoom: number; crop: CropState }) {
  const picture = useImageSrc(el.src)
  const { session, cropping } = crop
  return (
    <>
      {el.filter === 'duotone' && <DuotoneFilter id={el.id} duo={el.duo ?? DEFAULT_DUO} />}
      {cropping && session ? (
        <CropOverlay src={picture} box={el} from={session.from} draft={session.draft} zoom={zoom} flipX={el.flipX} flipY={el.flipY} onChange={crop.setDraft} />
      ) : (
        <div
          className="relative size-full overflow-hidden rounded-2xl shadow-soft"
          style={{ ...surface(el), transform: el.flipX || el.flipY ? `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})` : undefined }}
        >
          <img
            ref={crop.img}
            src={picture}
            alt=""
            decoding="async"
            loading="lazy"
            draggable={false}
            className="pointer-events-none size-full object-cover"
            style={{ ...(el.crop && cropStyle(el.crop)), filter: el.filter === 'mono' ? 'grayscale(1)' : el.filter === 'duotone' ? `url(#duo-${el.id})` : undefined }}
          />
        </div>
      )}
    </>
  )
}
