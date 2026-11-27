import { expect, test } from 'vitest'
import { boundsOf } from '../board/geometry.ts'
import { arrange, stageSize, startAt } from './stage.ts'

test('stageSize: full screen keeps the window shape with room for the toolbar; narrower stages are fixed blocks', () => {
  expect(stageSize(true, 1440, 900)).toEqual({ W: 1440, H: 900, Hu: 790, k: 1 })
  expect(stageSize(true, 2880, 1200)).toEqual({ W: 1440, H: 600, Hu: 490, k: 2 })
  expect(stageSize(true, 0, 0)).toEqual({ W: 1440, H: 900, Hu: 790, k: 1 })
  expect(stageSize(false, 900, 0)).toEqual({ W: 900, H: 560, Hu: 560, k: 1 })
  expect(stageSize(false, 360, 0)).toEqual({ W: 440, H: 480, Hu: 480, k: 360 / 440 })
})

test('startAt mirrors the right-hand photos and centers the block vertically', () => {
  const items = startAt(1440, 840)
  expect(items[0]).toMatchObject({ x: 24, y: 140 })
  expect(items[4]).toMatchObject({ x: 1440 - 24 - 150, y: 130 })
})

test('arrange centers a layout in the stage and zooms out only when it does not fit', () => {
  for (const mode of ['grid', 'fan', 'sunflower', 'collage'] as const) {
    const { items, z } = arrange(startAt(1440, 790), mode, 1440, 790)
    const b = boundsOf(items)
    expect(b.x + b.w / 2).toBeCloseTo(720)
    expect(b.y + b.h / 2).toBeCloseTo(395)
    expect(z).toBeLessThanOrEqual(1)
  }
  const { items } = arrange(startAt(440, 480), 'scatter', 440, 480)
  for (const it of items) expect(it.x).toBeGreaterThanOrEqual(20)
})
