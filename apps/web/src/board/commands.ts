import {
  AlignEndHorizontalIcon, AlignEndVerticalIcon, AlignHorizontalCenterIcon, AlignHorizontalSpaceBetweenIcon, AlignStartHorizontalIcon, AlignStartVerticalIcon, AlignVerticalCenterIcon,
  AlignVerticalSpaceBetweenIcon, ArtboardToolIcon, ColorsIcon, Copy01Icon, Delete02Icon, FitToScreenIcon, FolderUploadIcon, FrameIcon, GroupItemsIcon, Heading01Icon, Image01Icon,
  Layers01Icon, LayerBringForwardIcon, LockIcon, Maximize01Icon, LayerSendBackwardIcon, MinusSignIcon, PaintBoardIcon, PlusSignIcon, RedoIcon, StickyNote01Icon, UndoIcon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'
import { exportBoardFile, importBoardFile } from '../data/boardFile.ts'
import { LAYOUTS, type Layout } from './geometry.ts'
import { addImages, imageColors } from '../data/image.ts'
import { downloadPng } from '../data/png.ts'
import { useSettings } from './settings.ts'
import { switchBoard } from '../data/storage.ts'
import { duplicate, frameSelection, group, remove, reorder, rotateStep, toggleLock, ungroup } from './selection.ts'
import { hasUndo, useBoard } from './store.ts'
import { centerOn, fitAll, zoomTo } from './viewport.ts'

// Everything the command menu (Ctrl/Cmd+K) can do. Each entry reuses the same functions as the toolbar and the keys.

type State = ReturnType<typeof useBoard.getState>

export type Command = {
  id: string
  label: string
  /** extra words the search matches, e.g. "sticky" for a note */
  keywords?: string
  /** shown as a hint, written like the toolbar's ("Ctrl+Z") */
  shortcut?: string
  /** section heading; defaults to Edit (see groupOf) */
  group?: string
  /** hidden on a read-only board */
  edit?: boolean
  /** hidden unless this holds for the current board */
  when?: (s: State) => boolean
  /** `at` is a board point (where the context menu opened); without it things land mid-screen */
  run: (at?: { x: number; y: number }) => void
}

/** Default sizes of what gets added, shared by the toolbar, the menus and paste. */
export const SIZE = {
  note: { w: 220, h: 140 },
  heading: { w: 480, h: 84 },
  frame: { w: 480, h: 320 },
  color: { w: 140, h: 140 },
  pastedText: { w: 240, h: 160 },
}
export const DEFAULT_SWATCH = '#d6c7b4'

const ARROWS: Record<string, [number, number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
/** [dx, dy] for an arrow key moved by `step`, or undefined for any other key. Shared by nudging and Alt+arrow resizing. */
export const arrowDelta = (key: string, step: number): [number, number] | undefined => {
  const d = ARROWS[key]
  return d && [d[0] * step, d[1] * step]
}

const board = () => useBoard.getState()
const sel = (n: number) => (s: State) => s.selectedIds.length >= n
const ids = () => board().selectedIds
/** The first selected element, which is the only one for single-selection commands. */
const selected = () => board().elements.find((e) => e.id === ids()[0])
const one = (s: State) => s.selectedIds.length === 1
/** Puts every command of a run under one section heading. */
const inGroup = (group: string, list: Command[]): Command[] => list.map((c) => ({ ...c, group }))
/** The element type when exactly one element is selected. */
export const selectedKind = (s: State) => (s.selectedIds.length === 1 ? s.elements.find((e) => e.id === s.selectedIds[0])?.type : undefined)
const isFrame = (s: State) => selectedKind(s) === 'frame'
const isImage = (s: State) => selectedKind(s) === 'image'

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

const ALIGN = {
  left: 'Align left',
  hcenter: 'Align centers horizontally',
  right: 'Align right',
  top: 'Align top',
  vcenter: 'Align middles vertically',
  bottom: 'Align bottom',
} as const

export const commands: Command[] = [
  ...inGroup('Add', [
    { id: 'add-note', label: 'Add note', keywords: 'sticky text create new', edit: true, run: (at) => board().add({ type: 'note', text: '', ...SIZE.note }, at) },
    { id: 'add-heading', label: 'Add heading', keywords: 'title text create new', edit: true, run: (at) => board().add({ type: 'note', text: '', ...SIZE.heading, heading: true, bold: true }, at) },
    { id: 'add-frame', label: 'Add frame', keywords: 'artboard section create new', edit: true, run: (at) => board().add({ type: 'frame', title: '', ...SIZE.frame }, at) },
    { id: 'add-color', label: 'Add color', keywords: 'swatch create new', edit: true, run: (at) => board().add({ type: 'color', hex: DEFAULT_SWATCH, ...SIZE.color }, at) },
    { id: 'add-image', label: 'Add image', keywords: 'upload picture photo create new', edit: true, run: () => pickFiles(false) },
    { id: 'import-folder', label: 'Import folder', keywords: 'images directory upload', edit: true, run: () => pickFiles(true) },
  ]),
  { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', edit: true, when: hasUndo, run: () => board().undo() },
  { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Shift+Z', edit: true, when: (s) => s.future.length > 0, run: () => board().redo() },
  { id: 'select-all', label: 'Select all', shortcut: 'Ctrl+A', edit: true, when: (s) => s.elements.length > 0, run: () => board().selectMany(board().elements.map((e) => e.id)) },
  { id: 'duplicate', label: 'Duplicate', shortcut: 'Ctrl+D', edit: true, when: sel(1), run: () => duplicate(ids()) },
  { id: 'delete', label: 'Delete', shortcut: 'Delete', keywords: 'remove', edit: true, when: sel(1), run: () => remove(ids()) },
  { id: 'forward', label: 'Bring forward', shortcut: ']', keywords: 'layer order', edit: true, when: one, run: () => reorder(ids()[0], 'forward') },
  { id: 'backward', label: 'Send backward', shortcut: '[', keywords: 'layer order', edit: true, when: one, run: () => reorder(ids()[0], 'backward') },
  { id: 'frame-selection', label: 'Frame selection', shortcut: 'Ctrl+Alt+F', keywords: 'wrap', edit: true, when: sel(1), run: () => frameSelection(ids()) },
  { id: 'group', label: 'Group', shortcut: 'Ctrl+G', edit: true, when: sel(2), run: () => group(ids()) },
  { id: 'ungroup', label: 'Ungroup', shortcut: 'Ctrl+Shift+G', edit: true, when: (s) => s.elements.some((e) => e.groupId && s.selectedIds.includes(e.id)), run: () => ungroup(ids()) },
  {
    id: 'swatches',
    label: 'Swatches from image',
    keywords: 'colors palette extract',
    edit: true,
    when: isImage,
    run: () => {
      const el = selected()
      if (el?.type !== 'image') return
      imageColors(el.src).then(
        (hexes) => board().swatchRow(el.id, hexes),
        () => board().notify('Could not read the colors of that image.'),
      )
    },
  },
  { id: 'lock', label: 'Lock or unlock', keywords: 'freeze', edit: true, when: sel(1), run: () => toggleLock(ids()) },
  ...inGroup('Arrange', [
    ...(Object.keys(ALIGN) as (keyof typeof ALIGN)[]).map((mode) => ({
      id: `align-${mode}`,
      label: ALIGN[mode],
      edit: true,
      when: sel(2),
      run: () => board().align(ids(), mode),
    })),
    { id: 'distribute-x', label: 'Distribute horizontally', keywords: 'space', edit: true, when: sel(3), run: () => board().distribute(ids(), 'x') },
    { id: 'distribute-y', label: 'Distribute vertically', keywords: 'space', edit: true, when: sel(3), run: () => board().distribute(ids(), 'y') },
  ]),
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
    when: isImage,
    run: () => {
      const el = selected()
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
      const { arrange, elements, selectedIds } = board()
      // like the Arrange menu: the selection (2+), a frame's contents, or the whole board when nothing is selected
      const whole = selectedIds.length < 2 && !isFrame(board())
      arrange(whole ? elements.map((e) => e.id) : selectedIds, mode)
      if (whole) fitAll()
    },
  })),
  { id: 'export', label: 'Export board', group: 'File', keywords: 'save download json', when: (s) => s.elements.length > 0, run: exportBoardFile },
  { id: 'import', label: 'Import board…', group: 'File', keywords: 'open json', edit: true, run: () => pickJson() },
  { id: 'png', label: 'Download PNG', group: 'File', keywords: 'image export', when: (s) => s.elements.length > 0, run: downloadPng },
  { id: 'settings', label: 'Settings', group: 'File', keywords: 'preferences theme dark light', run: () => useSettings.setState({ open: true }) },
  ...inGroup('View', [
    { id: 'zoom-in', label: 'Zoom in', run: () => zoomTo(board().view.zoom * 1.25) },
    { id: 'zoom-out', label: 'Zoom out', run: () => zoomTo(board().view.zoom / 1.25) },
    { id: 'zoom-reset', label: 'Zoom to 100%', run: () => zoomTo(1) },
    { id: 'fit', label: 'Fit board in view', shortcut: '1', keywords: 'zoom all', when: (s) => s.elements.length > 0, run: fitAll },
  ]),
]

/** Whether a command makes sense on the board as it is now. */
export const enabled = (c: Command, s: State) => !(c.edit && s.readOnly) && (c.when?.(s) ?? true)

/** The commands that make sense on the board as it is now. */
export const available = (list: Command[]) => list.filter((c) => enabled(c, board()))

/** One registered command by id; the toolbar and the keys use this instead of redeclaring label, shortcut and action. */
export const command = (id: string) => commands.find((c) => c.id === id)!

/** Runs a command by id if it applies right now (what a key does). */
export function runCommand(id: string) {
  const c = command(id)
  if (enabled(c, board())) c.run()
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
export const groupOf = (c: Command) => c.group ?? 'Edit'

const ICONS: Record<string, IconSvgElement> = {
  'add-note': StickyNote01Icon, 'add-heading': Heading01Icon, 'add-frame': FrameIcon, 'add-color': PaintBoardIcon, 'add-image': Image01Icon, 'import-folder': FolderUploadIcon,
  undo: UndoIcon, redo: RedoIcon, duplicate: Copy01Icon, delete: Delete02Icon, forward: LayerBringForwardIcon, backward: LayerSendBackwardIcon,
  'frame-selection': ArtboardToolIcon, swatches: ColorsIcon, group: GroupItemsIcon, ungroup: Layers01Icon, lock: LockIcon, 'select-all': Maximize01Icon, 'zoom-in': PlusSignIcon, 'zoom-out': MinusSignIcon, fit: FitToScreenIcon,
  'align-left': AlignStartVerticalIcon, 'align-hcenter': AlignHorizontalCenterIcon, 'align-right': AlignEndVerticalIcon, 'align-top': AlignStartHorizontalIcon,
  'align-vcenter': AlignVerticalCenterIcon, 'align-bottom': AlignEndHorizontalIcon, 'distribute-x': AlignHorizontalSpaceBetweenIcon, 'distribute-y': AlignVerticalSpaceBetweenIcon,
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
          board().select(e.id)
          centerOn(e)
        },
      },
    ]
  })
  return [...boards, ...jump]
}
