# Map

Where each thing lives. Paths are relative to the repo root. Keep this file updated when you add, move or rename a file.

## "I want to change…" → go to

| I want to change… | File |
| --- | --- |
| Board state, selection (`selectedIds`), undo/redo (`HistoryEntry`: elements, palette edits and board style; `checkpoint`, `step`), add/move/delete/duplicate/reorder/align/distribute elements | [apps/web/src/board/store.ts](apps/web/src/board/store.ts) |
| Element types (`frame`, `image`, `note`, `color`, `link`): type in `BoardElement` (store.ts); per-kind validation, palette colours, own style keys, label: one module each in [apps/web/src/kinds/](apps/web/src/kinds/) registered in `kinds/index.ts` (a new kind is a compile error until registered) |
| Commands on the selection (nudge, delete, duplicate, rotate, reorder), the read-only gate, "what a command acts on" (`targetOf`) | [apps/web/src/board/selection.ts](apps/web/src/board/selection.ts) |
| Global shortcuts (undo/redo, and keys to selection commands without focus), paste handling | [apps/web/src/App.tsx](apps/web/src/App.tsx) |
| Per-element shortcuts (key to selection command; Alt+arrows resize, Enter) | [apps/web/src/components/ElementView.tsx](apps/web/src/components/ElementView.tsx) |
| Pan, zoom, wheel, drop files/links/board files | [apps/web/src/components/Canvas.tsx](apps/web/src/components/Canvas.tsx) |
| Align / distribute math | `alignOffsets`, `distributeOffsets` in [geometry.ts](apps/web/src/board/geometry.ts) |
| Multi-select: Shift+click, group drag | [ElementView.tsx](apps/web/src/components/ElementView.tsx); selection box in [Canvas.tsx](apps/web/src/components/Canvas.tsx); Ctrl+A, Delete/Esc without focus in [App.tsx](apps/web/src/App.tsx) |
| Alignment guides / snapping while dragging | `snapMove` in [geometry.ts](apps/web/src/board/geometry.ts), used in [ElementView.tsx](apps/web/src/components/ElementView.tsx), drawn in [Canvas.tsx](apps/web/src/components/Canvas.tsx) |
| Drag, resize, rotate math | [geometry.ts](apps/web/src/board/geometry.ts), [drag.ts](apps/web/src/board/drag.ts) |
| Bottom toolbar buttons, zoom buttons | [apps/web/src/components/Toolbar.tsx](apps/web/src/components/Toolbar.tsx) |
| Palette panel (rename, pin, hide colors, fonts, copy export) | [apps/web/src/components/PalettePanel.tsx](apps/web/src/components/PalettePanel.tsx) |
| How the palette is built from the board, hex parsing, image color sampling | [apps/web/src/palette/colors.ts](apps/web/src/palette/colors.ts) |
| CSS variables / Tailwind `@theme` output | [apps/web/src/palette/export.ts](apps/web/src/palette/export.ts) |
| Saving/loading boards (IndexedDB, autosave), creating, switching, renaming, deleting boards | [apps/web/src/data/storage.ts](apps/web/src/data/storage.ts) |
| Board name menu (top left: switch, rename, delete, new board) | [apps/web/src/components/BoardsMenu.tsx](apps/web/src/components/BoardsMenu.tsx) |
| Adding images (resize, read file) | [apps/web/src/data/image.ts](apps/web/src/data/image.ts) |
| Where images of local boards live: blob store, ids, `externalize` / `inline`, object URLs, sweep (ADR 0002) | [apps/web/src/data/images.ts](apps/web/src/data/images.ts) |
| Board snapshot: its shape, the validating parse for every source (file, share, local save), link repair, `openSnapshot` (replace / new / readonly), `capturePortable` (snapshot with images inline) | [apps/web/src/data/snapshot.ts](apps/web/src/data/snapshot.ts) |
| Board file export/import (`.lino.json`): download, upload, notices | [apps/web/src/data/boardFile.ts](apps/web/src/data/boardFile.ts) |
| File menu (export, import, PNG) | [apps/web/src/components/FileMenu.tsx](apps/web/src/components/FileMenu.tsx) |
| PNG export (canvas drawing of every element type) | [apps/web/src/data/png.ts](apps/web/src/data/png.ts) |
| Share button, read-only link, loading a shared board | [ShareButton.tsx](apps/web/src/components/ShareButton.tsx), [share.ts](apps/web/src/data/share.ts) |
| Adding links (URL detection, call to API) | [apps/web/src/board/link.ts](apps/web/src/board/link.ts) |
| Link card look | [apps/web/src/kinds/LinkBody.tsx](apps/web/src/kinds/LinkBody.tsx); shared look values (note colours, padding, tape, pin) in [kinds/look.ts](apps/web/src/kinds/look.ts), also read by png.ts |
| Color picker fields | [apps/web/src/components/ColorFields.tsx](apps/web/src/components/ColorFields.tsx) |
| Landing page | [apps/web/src/landing.tsx](apps/web/src/landing.tsx) |
| Theme tokens, fonts, global CSS | [apps/web/src/index.css](apps/web/src/index.css) |
| shadcn UI primitives | [apps/web/src/components/ui/](apps/web/src/components/ui/) |
| API routes, CORS, rate limit | [apps/api/src/routes.ts](apps/api/src/routes.ts) |
| What the API reads from a page (title, cover, fonts, colors) | [apps/api/src/extract.ts](apps/api/src/extract.ts) |
| SSRF protection, safe HTTP fetch, redirects | [apps/api/src/fetch.ts](apps/api/src/fetch.ts) |
| What a shared board may contain (body schema), share limits | [apps/api/src/routes.ts](apps/api/src/routes.ts) |
| Shared boards table, DB access, migrations | [schema.ts](apps/api/src/schema.ts), [boards.ts](apps/api/src/boards.ts), [drizzle/](apps/api/drizzle/) |
| Dev proxy, build pages, `@` alias | [apps/web/vite.config.ts](apps/web/vite.config.ts) |

## apps/web (React + Vite)

Two pages: `index.html` → `src/landing.tsx` (landing at `/`), `board/index.html` → `src/main.tsx` (board at `/board/`).

Layout of `apps/web/src/` (tests sit next to the code they test):

| Folder | Holds |
| --- | --- |
| `src/` (root) | Entries and shell only: `main.tsx`, `App.tsx`, `landing.tsx`, `pages.tsx`, `index.css` |
| `src/components/` | React UI: canvas, element view, toolbar, menus, panels (`components/ui/` = shadcn primitives) |
| `src/kinds/` | One module per element type (frame, image, note, color, link) |
| `src/board/` | Board logic, no I/O: store and undo, selection, commands, geometry, drag, viewport, layout, frames, crop, style, link helpers, settings |
| `src/data/` | Persistence and interchange: IndexedDB, images blob store, snapshot, board files, sharing, PNG export |
| `src/palette/` | Colour extraction, contrast, `.ase` and CSS/Tailwind export |

| File | What it does |
| --- | --- |
| `src/main.tsx` | Board entry. With `?s=<id>` opens that shared board read-only; otherwise loads the saved board and starts autosave. Renders `App`. |
| `src/App.tsx` | Board shell: canvas, toolbar, palette panel, empty state, notices. Window-level paste (image/URL/text) and undo/redo keys. |
| `src/components/Canvas.tsx` | The infinite canvas. Wheel pan, Ctrl+wheel zoom, background drag, file/link drop. Renders every `ElementView`. |
| `src/board/frames.ts` | Pure logic: `frameContents` (geometric membership), `frameAround`, `expandGroups`, `layoutInFrame`. |
| `src/board/selection.ts` | Selection commands shared by keyboard and toolbar: `targetOf`, `nudge`, `rotateStep`, `remove`, `duplicate`, `reorder`. One read-only check; one undo step each (a burst of nudges or rotations is one). |
| `src/components/ElementView.tsx` | One element on the board: position, selection, drag, resize/rotate handles, keyboard actions; picks the body of its kind. |
| `src/kinds/*Body.tsx`, `useCrop.ts`, `ElementDeco.tsx`, `look.ts` | What each kind shows (frame, image, note, color, link), crop mode, tape/pin/lock badge, and the look values png.ts shares. |
| `src/components/ColorFields.tsx` | Hex input + native color input used in the color popover. |
| `src/components/Toolbar.tsx` | Floating bottom toolbar: add image/note/color, undo/redo, selected-element actions (duplicate, layers, delete), zoom, palette toggle. |
| `src/components/PalettePanel.tsx` | Side panel with the board palette and fonts; copy as CSS or Tailwind. |
| `src/board/store.ts` | Zustand store: elements (array order = z-order), selection, view, undo history (whole snapshots), palette metadata, `readOnly`. |
| `src/data/storage.ts` | IndexedDB load/save, debounced autosave subscribed to the store. |
| `src/palette/colors.ts` | `normalizeHex`, `buildPalette` (colors from swatches, links, images + user meta), `boardFonts`, `dominantColors`. |
| `src/palette/export.ts` | `exportTheme('css' \| 'tailwind', colors, fonts)` and slug naming. |
| `src/board/geometry.ts` | Box math: rotate, resize with aspect lock, rotation snap, zoom around a point, fit view to content, rotated bounds, `snapMove` (alignment snapping + guides), `alignOffsets`, `distributeOffsets`. |
| `src/board/drag.ts` | Pointer-drag helper used by move/resize/rotate. |
| `src/data/image.ts` | Read an image file into a data URL and add it to the board. |
| `src/data/images.ts` | Image blob store interface, content-hash ids, `externalize`/`inline`, `useImageSrc`, sweep. |
| `src/data/db.ts` | The IndexedDB database (`boards` and `images` stores) and the blob store wired to it. |
| `src/data/boardFile.ts` | `exportBoardFile()` (images inline), `importBoardFile(file)`; parsing lives in `snapshot.ts`. |
| `src/components/FileMenu.tsx` | Toolbar folder popover: export board, import board, download PNG. |
| `src/data/png.ts` | `boardPng()` draws all elements to a canvas (theme colors, fonts, rotation); `downloadPng()`; `wrapText()`. |
| `src/data/share.ts` | `shareBoard()` (POST snapshot, returns link), `loadShared(id)` (read-only, fitted view). |
| `src/components/ShareButton.tsx` | Toolbar Share popover: confirm, create link, copy. |
| `src/board/link.ts` | `asUrl`, `addLink`: calls `GET /read`, samples the cover's colors, adds a link card. |
| `src/landing.tsx` | Marketing landing page with the animated demo board. |
| `src/index.css` | Tailwind import, theme tokens, fonts. |
| `src/lib/utils.ts` | `cn()` class helper (shadcn). |
| `src/components/ui/*` | shadcn components: button, empty, field, input, kbd, label, popover, separator, tooltip. |
| `src/*.test.ts` | Vitest: board snapshot parsing, images, selection commands, colors, export, geometry, png text wrap, store. |
| `components.json` | shadcn config. |
| `.env.example` | `VITE_API_URL`. |

## apps/api (Fastify, Node 24, no build)

| File | What it does |
| --- | --- |
| `src/server.ts` | Entry (also Vercel's Fastify entry): connects Postgres if `DATABASE_URL` (migrates on start except on Vercel), builds the app and listens (`PORT`, `TRUST_PROXY`). |
| `src/routes.ts` | `buildApp()` (not named app.ts: Vercel would pick it as the entry): `GET /health`, `GET /read?url=`, `POST /boards`, `GET /boards/:id`, CORS + preflight, in-memory rate limits per IP. |
| `src/migrate.ts` | Applies migrations; run by `vercel-build` at deploy (uses `DATABASE_URL_UNPOOLED` when set). |
| `src/schema.ts` | Drizzle table `boards` (id, jsonb snapshot, bytes, created/expires). |
| `src/boards.ts` | `BoardStore` type, `migrateDb(url)`, `pgBoards(url)`: insert (sweeps expired), get unexpired. |
| `drizzle/` | Generated SQL migrations (`drizzle-kit generate`). |
| `drizzle.config.ts` | drizzle-kit config. |
| `src/extract.ts` | `readLink()`: fetches the page, parses title/cover from HTML, reads fonts and colors from stylesheets, returns cover as a data URL. |
| `src/fetch.ts` | `safeFetch()`: public http(s) only, ports 80/443, blocks private IPs at DNS lookup, re-checks each redirect, size and time caps. |
| `src/*.test.ts` | `node --test`: loading `server.ts` the way Vercel does, app routes, link reading with a fake fetcher, board sharing with an in-memory store. |
| `Dockerfile` | Production image (`node src/server.ts`). |
| `.env.example` | `CORS_ORIGIN`, `TRUST_PROXY`, `DATABASE_URL`. |

## Repo root

| Path | What |
| --- | --- |
| `README.md` | Overview, how to run, deploy steps, shortcuts. |
| `docs/adr/` | Architecture decisions (0001: Vercel + Neon deploy). |
| `CLAUDE.md`, `docs/agents/` | Instructions for coding agents (issue tracker, labels, domain docs). |
| `.scratch/<feature>/` | Local markdown issues. |
| `.claude/launch.json` | Dev server configs (`web`, `api`). |
| `.agents/`, `.claude/skills/`, `skills-lock.json` | Installed agent skills. |
| `pnpm-workspace.yaml` | Workspace: `apps/*`. |
| `docker-compose.yml` | Local Postgres for the API. |
