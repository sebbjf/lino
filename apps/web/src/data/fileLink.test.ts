import { describe, expect, test } from 'vitest'
import { canUseFiles, contentChanged, saveDecision, showUnsavedDot } from './fileLink.ts'
import { useBoard } from '../board/store.ts'

test('disk files require both pickers', () => {
  const picker = () => {}
  expect(canUseFiles({})).toBe(false)
  expect(canUseFiles({ showOpenFilePicker: picker })).toBe(false)
  expect(canUseFiles({ showSaveFilePicker: picker })).toBe(false)
  expect(canUseFiles({ showOpenFilePicker: picker, showSaveFilePicker: picker })).toBe(true)
})

test('Save writes or asks about an external change', () => {
  expect(saveDecision({ lastModified: 20 }, 20)).toBe('write')
  expect(saveDecision({ lastModified: 20 }, 21)).toBe('ask-overwrite')
  expect(saveDecision({ lastModified: 20 }, 19)).toBe('ask-overwrite')
})

test('only a dirty linked board shows a dot when the pickers are available', () => {
  expect(showUnsavedDot(true, undefined)).toBe(false)
  expect(showUnsavedDot(true, { dirty: false })).toBe(false)
  expect(showUnsavedDot(true, { dirty: true })).toBe(true)
  expect(showUnsavedDot(false, { dirty: true })).toBe(false)
})

describe('content changes', () => {
  const board = useBoard.getInitialState()

  test('marks elements, palette edits, and board style', () => {
    expect(contentChanged({ ...board, elements: [{ id: 'n', type: 'note', text: 'Hi', x: 0, y: 0, w: 100, h: 50, rotation: 0 }] }, board)).toBe(true)
    expect(contentChanged({ ...board, colorMeta: { '#aabbcc': { name: 'Sky' } } }, board)).toBe(true)
    expect(contentChanged({ ...board, board: { bg: '#aabbcc' } }, board)).toBe(true)
  })

  test('ignores pan, zoom, renaming and switching boards', () => {
    const panned = { ...board, view: { x: 3, y: 9, zoom: 2 } }
    const renamed = { ...board, boards: [{ id: board.boardId, name: 'Renamed' }] }
    expect(contentChanged(panned, board)).toBe(false)
    expect(contentChanged(renamed, board)).toBe(false)
    expect(contentChanged({ ...board, boardId: 'another', board: { bg: '#aabbcc' } }, board)).toBe(false)
  })
})
