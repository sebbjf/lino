import { expect, test } from 'vitest'
import type { Box } from './types.ts'
import { KINDS } from './index.ts'

const image = KINDS.image

test('image parse keeps paletteOff; a save with no colours field stays unset, not []', () => {
  const box = { id: 'i', x: 0, y: 0, w: 1, h: 1, rotation: 0 } as Box
  const isPicture = (v: unknown): v is string => typeof v === 'string'
  const on = image.parse({ src: 'a.png', paletteOff: true }, box, { isPicture })
  expect(on).toMatchObject({ paletteOff: true })
  expect(image.colors(on!)).toEqual([])
  expect(image.parse({ src: 'a.png', paletteOff: 'yes' }, box, { isPicture })).not.toHaveProperty('paletteOff')
  expect(image.parse({ src: 'a.png' }, box, { isPicture })).not.toHaveProperty('colors')
})
