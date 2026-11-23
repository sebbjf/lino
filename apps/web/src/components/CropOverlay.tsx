import type { PointerEvent } from 'react'
import { cropStyle, dragCrop, type Crop } from '../board/crop.ts'
import { drag } from '../board/drag.ts'
import { rotateVec } from '../board/geometry.ts'

const EDGES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

type Props = {
  src: string | undefined
  /** Element box and zoom: where the crop was when crop mode began (`from` fills the box). */
  box: { w: number; h: number; rotation: number }
  from: Crop
  draft: Crop
  zoom: number
  flipX?: boolean
  flipY?: boolean
  onChange: (c: Crop) => void
}

/** Crop mode for an image: the whole picture dimmed, the kept part bright, and handles on its edges and corners. */
export function CropOverlay({ src, box, from, draft, zoom, flipX, flipY, onChange }: Props) {
  const stageW = box.w / from.w
  const stageH = box.h / from.h
  const handle = (matchMedia('(pointer: coarse)').matches ? 32 : 12) / zoom

  const start = (edge: string) => (e: PointerEvent) => {
    e.stopPropagation()
    const c0 = draft
    drag(e, (dx, dy) => {
      const d = rotateVec(dx / zoom, dy / zoom, -box.rotation) // screen to the element's own axes
      onChange(dragCrop(c0, edge, (d.x / stageW) * (flipX ? -1 : 1), (d.y / stageH) * (flipY ? -1 : 1)))
    })
  }

  return (
    <div
      aria-hidden
      className="absolute"
      style={{ left: -from.x * stageW, top: -from.y * stageH, width: stageW, height: stageH, transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})` }}
    >
      <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 size-full opacity-35" />
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${draft.x * 100}%`,
          top: `${draft.y * 100}%`,
          width: `${draft.w * 100}%`,
          height: `${draft.h * 100}%`,
          outline: `${1.5 / zoom}px solid var(--color-ring)`,
        }}
      >
        <img src={src} alt="" draggable={false} className="pointer-events-none" style={cropStyle(draft)} />
      </div>
      <div className="absolute" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}>
        {EDGES.map((edge) => {
          const left = edge.includes('w') ? '0%' : edge.includes('e') ? '100%' : '50%'
          const top = edge.includes('n') ? '0%' : edge.includes('s') ? '100%' : '50%'
          // a mirrored stage swaps which screen corner a diagonal handle sits on
          const diagonal = edge.length === 2 && ['nw', 'se'].includes(edge) !== (!!flipX !== !!flipY)
          const cursor = edge.length === 1 ? (edge === 'n' || edge === 's' ? 'ns-resize' : 'ew-resize') : diagonal ? 'nwse-resize' : 'nesw-resize'
          return (
            <div
              key={edge}
              className="absolute rounded-full border-ring bg-card"
              style={{ left, top, width: handle, height: handle, marginLeft: -handle / 2, marginTop: -handle / 2, borderWidth: 1.5 / zoom, cursor }}
              onPointerDown={start(edge)}
            />
          )
        })}
      </div>
    </div>
  )
}
