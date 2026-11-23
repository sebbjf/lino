import { useEffect, useRef, useState, type RefObject } from 'react'
import { coverCrop, cropBox, type Crop } from '../crop.ts'
import { useBoard, type BoardElement } from '../store.ts'

/**
 * Crop mode of one element: `from` is the crop the box shows now, `draft` the one being dragged out.
 * `root` is the element's div (a press outside it confirms); `img` must be attached to the picture to read its size.
 */
export function useCrop(el: BoardElement, root: RefObject<HTMLDivElement | null>) {
  const { update, step, setCropId } = useBoard.getState()
  const cropId = useBoard((s) => s.cropId)
  const img = useRef<HTMLImageElement>(null)
  const [session, setSession] = useState<{ from: Crop; draft: Crop } | null>(null)
  const cropping = !!session && cropId === el.id

  useEffect(() => {
    if (cropId !== el.id || el.type !== 'image') return setSession(null)
    const i = img.current
    if (!i?.naturalWidth) return setCropId(null)
    const from = el.crop ?? coverCrop(el.w, el.h, i.naturalWidth, i.naturalHeight)
    setSession({ from, draft: from })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropId])

  /** Confirms or cancels crop mode; a confirmed change is one undo step. */
  const finish = (ok: boolean) => {
    if (ok && session && el.type === 'image' && (['x', 'y', 'w', 'h'] as const).some((k) => session.draft[k] !== session.from[k]))
      step(() => update(el.id, { ...cropBox(el, session.from, session.draft, { x: el.flipX, y: el.flipY }), crop: session.draft }))
    setCropId(null)
  }
  const finishRef = useRef(finish)
  useEffect(() => {
    finishRef.current = finish
  })
  // a press outside the element confirms
  useEffect(() => {
    if (!cropping) return
    const out = (e: globalThis.PointerEvent) => !root.current?.contains(e.target as Node) && finishRef.current(true)
    document.addEventListener('pointerdown', out, true)
    return () => document.removeEventListener('pointerdown', out, true)
  }, [cropping, root])

  return { img, session, cropping, finish, setDraft: (draft: Crop) => session && setSession({ ...session, draft }) }
}

export type CropState = ReturnType<typeof useCrop>
