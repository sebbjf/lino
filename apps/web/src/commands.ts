import {
  AlignHorizontalCenterIcon, ArtboardToolIcon, ColorsIcon, Copy01Icon, Delete02Icon, FolderUploadIcon, FrameIcon, GroupItemsIcon, Heading01Icon, Image01Icon,
  Layers01Icon, LayerBringForwardIcon, LayerSendBackwardIcon, MinusSignIcon, PaintBoardIcon, PlusSignIcon, RedoIcon, StickyNote01Icon, UndoIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { exportBoardFile, importBoardFile } from './boardFile.ts'
import { fitView, LAYOUTS, zoomAt, type Layout } from './geometry.ts'
import { addImages, imageColors } from './image.ts'
import { downloadPng } from './png.ts'
import { rotateStep } from './selection.ts'
import { switchBoard } from './storage.ts'
import { duplicate, frameSelection, group, remove, reorder, toggleLock, ungroup } from './selection.ts'
import { hasUndo, useBoard } from './store.ts'

// Everything the command menu (Ctrl/Cmd+K) can do. Each entry reuses the same functions as the toolbar and the keys.

type State = ReturnType<typeof useBoard.getState>

export type Command = {
  id: string
  label: string
  /** extra words the search matches, e.g. "sticky" for a note */
  keywords?: string
  /** shown as a hint, written like the toolbar's ("Ctrl+Z") */
  shortcut?: string
  /** section heading; defaults to Edit */
  group?: string
  /** hidden on a read-only board */
  edit?: boolean
  /** hidden unless this holds for the current board */
  when?: (s: State) => boolean
  run: () => void
}

const board = () => useBoard.getState()
const sel = (n: number) => (s: State) => s.selectedIds.length >= n
const ids = () => board().selectedIds
const isFrame = (s: State) => s.selectedIds.length === 1 && s.elements.find((e) => e.id === s.selectedIds[0])?.type === 'frame'

function pickJson() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = () => input.files?.[0] && importBoardFile(input.files[0])
  input.click()
}

function pickFiles(directory: boolean) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = true
  if (directory) input.setAttribute('webkitdirectory', '')
  else input.accept = 'image/*'
  input.onchange = () => addImages([...(input.files ?? [])].filter((f) => f.type.startsWith('image/')))
  input.click()
}

function zoomTo(z: number) {
  const { view, setView } = board()
  setView(zoomAt(view, innerWidth / 2, innerHeight / 2, z))
}

const ALIGN = {
  left: 'Align left',
  hcenter: 'Align centers horizontally',
  right: 'Align right',
  top: 'Align top',
  vcenter: 'Align middles vertically',
  bottom: 'Align bottom',
} as const

export const commands: Command[] = [
  { id: 'add-note', label: 'Add note', keywords: 'sticky text create new', edit: true, run: () => board().add({ type: 'note', text: '', w: 220, h: 140 }) },
  { id: 'add-heading', label: 'Add heading', keywords: 'title text create new', edit: true, run: () => board().add({ type: 'note', text: '', w: 480, h: 84, heading: true, bold: true }) },
  { id: 'add-frame', label: 'Add frame', keywords: 'artboard section create new', edit: true, run: () => board().add({ type: 'frame', title: '', w: 480, h: 320 }) },
  { id: 'add-color', label: 'Add color', keywords: 'swatch create new', edit: true, run: () => board().add({ type: 'color', hex: '#d6c7b4', w: 140, h: 140 }) },
  { id: 'add-image', label: 'Add image', keywords: 'upload picture photo create new', edit: true, run: () => pickFiles(false) },
  { id: 'import-folder', label: 'Import folder', keywords: 'images directory upload', edit: true, run: () => pickFiles(true) },
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', edit: true, when: hasUndo, run: () => board().undo() },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', edit: true, when: (s) => s.future.length > 0, run: () => board().redo() },
  { id: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', edit: true, when: (s) => s.elements.length > 0, run: () => board().selectMany(board().elements.map((e) => e.id)) },
  { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', edit: true, when: sel(1), run: () => duplicate(ids()) },
  { id: 'delete', label: 'Delete', shortcut: 'Delete', keywords: 'remove', edit: true, when: sel(1), run: () => remove(ids()) },
  { id: 'forward', label: 'Bring forward', shortcut: ']', keywords: 'layer order', edit: true, when: (s) => s.selectedIds.length === 1, run: () => reorder(ids()[0], 'forward') },
  { id: 'backward', label: 'Send backward', shortcut: '[', keywords: 'layer order', edit: true, when: (s) => s.selectedIds.length === 1, run: () => reorder(ids()[0], 'backward') },
  { id: 'frame-selection', label: 'Frame selection', shortcut: 'Ctrl+Alt+F', keywords: 'wrap', edit: true, when: sel(1), run: () => frameSelection(ids()) },
  { id: 'group', label: 'Group', shortcut: 'Ctrl+G', edit: true, when: sel(2), run: () => group(ids()) },
  { id: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', edit: true, when: (s) => s.elements.some((e) => e.groupId && s.selectedIds.includes(e.id)), run: () => ungroup(ids()) },
  {
    id: 'swatches',
    label: 'Swatches from image',
    keywords: 'colors palette extract',
    edit: true,
    when: (s) => s.selectedIds.length === 1 && s.elements.find((e) => e.id === s.selectedIds[0])?.type === 'image',
    run: () => {
      const el = board().elements.find((e) => e.id === ids()[0])
      if (el?.type !== 'image') return
      imageColors(el.src).then(
        (hexes) => board().swatchRow(el.id, hexes),
        () => board().notify('Could not read the colors of that image.'),
      )
    },
  },
  { id: 'lock', label: 'Lock or unlock', keywords: 'freeze', edit: true, when: sel(1), run: () => toggleLock(ids()) },
  ...(Object.keys(ALIGN) as (keyof typeof ALIGN)[]).map((mode) => ({
    id: `align-${mode}`,
    label: ALIGN[mode],
    edit: true,
    when: sel(2),
    run: () => board().align(ids(), mode),
  })),
  { id: 'distribute-x', label: 'Distribute horizontally', keywords: 'space', edit: true, when: sel(3), run: () => board().distribute(ids(), 'x') },
  { id: 'distribute-y', label: 'Distribute vertically', keywords: 'space', edit: true, when: sel(3), run: () => board().distribute(ids(), 'y') },
  { id: 'rotate-cw', label: 'Rotate 15° clockwise', shortcut: 'R', edit: true, when: sel(1), run: () => rotateStep(ids(), 1) },
  { id: 'rotate-ccw', label: 'Rotate 15° counter-clockwise', shortcut: 'Shift+R', edit: true, when: sel(1), run: () => rotateStep(ids(), -1) },
  {
    id: 'shadow',
    label: 'Toggle shadow',
    edit: true,
    when: sel(1),
    run: () => {
      const els = board().elements.filter((e) => ids().includes(e.id))
      const on = !els.every((e) => e.shadow !== false)
      board().step(() => els.forEach((e) => board().update(e.id, { shadow: on })))
    },
  },
  ...(['flipX', 'flipY'] as const).map((key) => ({
    id: `flip-${key}`,
    label: key === 'flipX' ? 'Flip image horizontally' : 'Flip image vertically',
    edit: true,
    when: (s: State) => s.selectedIds.length === 1 && s.elements.find((e) => e.id === s.selectedIds[0])?.type === 'image',
    run: () => {
      const el = board().elements.find((e) => e.id === ids()[0])
      if (el?.type === 'image') board().step(() => board().update(el.id, { [key]: el[key] ? undefined : true }))
    },
  })),
  ...LAYOUTS.map((mode: Layout) => ({
    id: `layout-${mode}`,
    label: `Arrange as ${mode}`,
    group: 'Arrange',
    keywords: 'layout',
    edit: true,
    when: (s: State) => (s.selectedIds.length < 2 ? s.elements.length >= 2 || isFrame(s) : true),
    run: () => {
      const { arrange, elements, setView, selectedIds } = board()
      // like the Arrange menu: the selection (2+), a frame's contents, or the whole board when nothing is selected
      const whole = selectedIds.length < 2 && !isFrame(board())
      arrange(whole ? elements.map((e) => e.id) : selectedIds, mode)
      if (whole) setView(fitView(board().elements, innerWidth, innerHeight))
    },
  })),
  { id: 'export', label: 'Export board', group: 'File', keywords: 'save download json', when: (s) => s.elements.length > 0, run: exportBoardFile },
  { id: 'import', label: 'Import board…', group: 'File', keywords: 'open json', edit: true, run: () => pickJson() },
  { id: 'png', label: 'Download PNG', group: 'File', keywords: 'image export', when: (s) => s.elements.length > 0, run: downloadPng },
  { id: 'zoom-in', label: 'Zoom in', run: () => zoomTo(board().view.zoom * 1.25) },
  { id: 'zoom-out', label: 'Zoom out', run: () => zoomTo(board().view.zoom / 1.25) },
  { id: 'zoom-reset', label: 'Zoom to 100%', run: () => zoomTo(1) },
  { id: 'fit', label: 'Fit board in view', shortcut: '1', keywords: 'zoom all', when: (s) => s.elements.length > 0, run: () => board().setView(fitView(board().elements, innerWidth, innerHeight)) },
]

/** The commands that make sense on the board as it is now. */
export function available(list: Command[]) {
  const s = board()
  return list.filter((c) => !(c.edit && s.readOnly) && (c.when?.(s) ?? true))
}

/** Every query word must start a word of the label or keywords; commands whose label matches rank first. */
export function search(list: Command[], query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return list
  const starts = (text: string, w: string) => text.split(/\s+/).some((t) => t.startsWith(w))
  return list
    .map((c) => {
      const label = c.label.toLowerCase()
      const extra = (c.keywords ?? '').toLowerCase()
      if (!words.every((w) => starts(label, w) || starts(extra, w))) return null
      return { c, score: words.filter((w) => starts(label, w)).length }
    })
    .filter((x) => x !== null)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.c)
}

/** Section a command is listed under, shown as a heading while the search is empty. */
export const groupOf = (c: Command) => c.group ?? (/^(add|import)/.test(c.id) ? 'Add' : /^(align|distribute)/.test(c.id) ? 'Arrange' : /^(zoom|fit)/.test(c.id) ? 'View' : 'Edit')

const ICONS: Record<string, IconSvgElement> = {
  'add-note': StickyNote01Icon, 'add-heading': Heading01Icon, 'add-frame': FrameIcon, 'add-color': PaintBoardIcon, 'add-image': Image01Icon, 'import-folder': FolderUploadIcon,
  undo: UndoIcon, redo: RedoIcon, duplicate: Copy01Icon, delete: Delete02Icon, forward: LayerBringForwardIcon, backward: LayerSendBackwardIcon,
  'frame-selection': ArtboardToolIcon, swatches: ColorsIcon, group: GroupItemsIcon, ungroup: Layers01Icon, 'zoom-in': PlusSignIcon, 'zoom-out': MinusSignIcon, fit: ColorsIcon,
}
export const iconOf = (c: Command) => ICONS[c.id] ?? AlignHorizontalCenterIcon

const snippet = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 50)

/** Commands that depend on what is on the board: switch to another board, jump to an element by its text. Read when the menu opens. */
export function dynamicCommands(): Command[] {
  const s = board()
  const boards: Command[] = s.readOnly
    ? []
    : s.boards
        .filter((b) => b.id !== s.boardId)
        .map((b) => ({ id: `board-${b.id}`, label: `Open board: ${b.name}`, group: 'Boards', keywords: 'switch go', run: () => void switchBoard(b.id) }))
  const jump: Command[] = s.elements.flatMap((e) => {
    const text = e.type === 'note' ? e.text : e.type === 'frame' ? e.title : e.type === 'link' ? (e.title ?? e.url) : ''
    if (!snippet(text)) return []
    return [
      {
        id: `go-${e.id}`,
        label: `Go to ${snippet(text)}`,
        group: 'Go to',
        run: () => {
          const { view, setView, select } = board()
          select(e.id)
          setView({ ...view, x: innerWidth / 2 - (e.x + e.w / 2) * view.zoom, y: innerHeight / 2 - (e.y + e.h / 2) * view.zoom })
        },
      },
    ]
  })
  return [...boards, ...jump]
}
