# Roadmap: the best open-source moodboard app

Status: reference. First written 2026-11-16 after the UX and security audits; updated the same day with what has shipped since and with the architecture review. The ideas come from reading the code and from general knowledge of the alternatives (PureRef, Milanote, Figma/FigJam, Are.na; open source: BeeRef, Excalidraw, tldraw), not from fresh market research. Some may partly exist already in code that was not read (`geometry.ts`, `png.ts`).

## Positioning

Do not compete as a general whiteboard: Excalidraw and tldraw already win there. The gap Lino can own is **the moodboard that ends in a design system**. It already reads colors and fonts from links and exports CSS, Tailwind and Design Tokens JSON; no open-source alternative does. Everything else should serve that idea, with no account and local-first.

## How to read this

Work comes in four tracks. Pick from the top of a track; the dependency list below says what must come before what.

1. **Cheap, any time**: `performance` items 1-3 and `quick-wins`. They need nothing else.
2. **Structure**: the architecture review (`architecture-review`). Small refactors that make the feature work cheaper and safer.
3. **Features**: the numbered specs, in order.
4. **Reserve**: `idea-backlog` (promote an idea to its own spec when picked up) and `audit-followups` (what the audits left open).

## 1. Cheap, any time

| Spec | What | State |
|---|---|---|
| `performance` | 1 save the view apart from images, 2 `memo` on `ElementView` (already wrapped), 3 lazy image decoding | **1-3 done** (`bb6594c`). Open: 4 lazy-load PNG export and style menu, 5 landing fonts |
| `quick-wins` | Contrast in the palette, selection to PNG, zoom to fit, `?` cheat sheet, lock, paste a hex, final batch notice | **Zoom to fit and paste a hex done** (uncommitted). Open: contrast, selection to PNG, `?` cheat sheet, lock, batch notice |

## 2. Structure (architecture review)

Overview in `architecture-review`. These are not features; they exist so features land in one place instead of four.

| Spec | State | Why it is on the roadmap |
|---|---|---|
| `board-snapshot` | **Done** (`9cd345a`) | Do before `image-storage`, `templates-and-gallery`, `collaboration` and "back up all boards": each of them changes or moves the saved shape, and today that shape lives in four files. |
| `undo-history` | Needs triage | Cheapest win; the snapshot's "open is one undo step" and `collaboration` both lean on it. |
| `selection-commands` | **Designed, ready for agent** (grilled 2026-11-17) | Do with "lock elements" (`quick-wins`, `image-tools`): the read-only/locked check should live in one place. |
| `element-kinds` | Needs triage | Do right before `frames-and-groups`, which adds a fifth kind; that is the trigger the spec was waiting for. |
| `move-gesture` | Needs triage, speculative | Only if drag bugs keep showing up; also relevant once groups change what a drag moves. |

## 3. Features, in recommended order

Each has its own `.scratch/<slug>/spec.md`.

| # | Spec | Group | State | Comes after |
|---|---|---|---|---|
| 1 | `image-storage` | Foundations | **Done** (`18df2d5`, `2ab4b0c`; grilled 2026-11-17, `docs/adr/0002`): blobs in a local store, snapshot stays self-contained, lazy migration, sweep at start. Thumbnails by zoom and viewport culling are split out, to be specced after measuring. The only one with real technical risk | `board-snapshot` (done) |
| 2 | `palette-from-images` | Foundations | **First version shipped**: image colours join the palette, swatches from image. Open: backfill for old images, per-image opt-out | |
| 3 | `image-tools` | Foundations | Not started | `selection-commands` for lock |
| 4 | `frames-and-groups` | Foundations | Not started | `element-kinds` |
| 5 | `quick-capture` | Foundations | Not started | |
| 6 | `design-token-export` | Differentiators | **Partly shipped**: Design Tokens JSON. Open: Figma variables, `.ase`, pair contrast check, type specimen | |
| 7 | `local-files-and-pwa` | Open source | Not started | `board-snapshot` (the file adapter) |
| 8 | `present-and-export` | Differentiators | Not started | |
| 9 | `motion-media` | Differentiators | Not started | `image-storage` (video blobs) |
| 10 | `templates-and-gallery` | Differentiators | Not started | `board-snapshot` (a template is a snapshot) |
| 11 | `self-hosting` | Open source | Not started | |
| 12 | `community` | Open source | Not started | |
| 13 | `collaboration` | Open source, last | Not started; the most expensive | 1-5 solid, `board-snapshot`, `undo-history` |

Since the first draft, 2 and 6 moved from "idea" to partly shipped, and masonry arrange for images added together landed (`9d21fe3`). The list order is otherwise unchanged.

## Suggested next steps

1. ~~`performance` 1-3 and the cheapest `quick-wins` (zoom to fit, paste a hex)~~ done.
2. ~~`board-snapshot`~~ done.
3. `image-storage` (designed; 4 commits in its spec): the real fix for image-heavy boards. Then `selection-commands`, then `undo-history` (order chosen 2026-11-17; both still need grilling). After image-storage, measure and decide whether thumbnails by zoom and viewport culling are worth their own specs.
4. Finish `design-token-export` (contrast, tone scales from `idea-backlog`): this is the positioning, so it should keep moving while the foundations are built.
5. `element-kinds` then `frames-and-groups`.

## Reserve

- `idea-backlog`: sort by color, back up all boards (needs `board-snapshot`), style tile, tone scales, settings menu. "Do first" there are sort by color, back up all boards and style tile.
- `audit-followups`: 7 tickets the audits left open (deploy verification, two tabs overwriting each other, CSP, touch editing, revoking a shared board, platform-aware shortcut labels, minor cleanups). Touch and mobile gaps are `04` and `06`. Two tabs overwriting (`02`) relates to `board-snapshot` and to `collaboration`.

## Non-goals

- **Required accounts**: "no account" is part of the appeal.
- **Arrows, connectors, diagrams**: that is a different app.
- **Built-in AI by default**: at most optional and bring-your-own-key (auto-tagging, naming palettes).
