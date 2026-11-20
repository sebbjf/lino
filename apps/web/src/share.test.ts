import { expect, test } from 'vitest'
import { fitSnapshot } from './share.ts'

const snap = (src: string) => ({ elements: [{ id: 'a', type: 'image' as const, src, x: 0, y: 0, w: 1, h: 1, rotation: 0 }], colorMeta: {}, board: {} })
const big = `data:image/webp;base64,${'A'.repeat(1000)}`
// fake shrink: each level keeps a smaller slice, so the test needs no canvas
const shrink = async (s: string, { side }: { side: number }) => s.slice(0, Math.floor(side / 2))

test('fitSnapshot returns the first level that fits and leaves the original alone', async () => {
  const original = snap(big)
  const fit = await fitSnapshot(original, 900, shrink)
  expect(fit?.elements[0]).toMatchObject({ src: big.slice(0, 600) }) // 1200px level fits 900 bytes
  expect((original.elements[0] as { src: string }).src).toBe(big)
})

test('fitSnapshot gives up when even the smallest level is too big', async () => {
  expect(await fitSnapshot(snap(big), 100, shrink)).toBeNull()
})
