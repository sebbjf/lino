# Map

Where each thing lives. Paths are relative to the repo root. Keep this file updated when you add, move or rename a file.

## "I want to change…" → go to

| I want to change… | File |
| --- | --- |
| Board state, undo/redo, add/move/delete/duplicate/reorder elements | [apps/web/src/store.ts](apps/web/src/store.ts) |
| Element types (`image`, `note`, `color`, `link`) | `BoardElement` in [store.ts](apps/web/src/store.ts) |
| Global shortcuts (undo/redo), paste handling | [apps/web/src/App.tsx](apps/web/src/App.tsx) |
| Per-element shortcuts (arrows, Delete, Ctrl+D, `[` `]`, Enter) | [apps/web/src/ElementView.tsx](apps/web/src/ElementView.tsx) |
| Pan, zoom, wheel, drop files/links | [apps/web/src/Canvas.tsx](apps/web/src/Canvas.tsx) |
| Drag, resize, rotate math | [geometry.ts](apps/web/src/geometry.ts), [drag.ts](apps/web/src/drag.ts) |
| Bottom toolbar buttons, zoom buttons | [apps/web/src/Toolbar.tsx](apps/web/src/Toolbar.tsx) |
| Palette panel (rename, pin, hide colors, fonts, copy export) | [apps/web/src/PalettePanel.tsx](apps/web/src/PalettePanel.tsx) |
| How the palette is built from the board, hex parsing, image color sampling | [apps/web/src/colors.ts](apps/web/src/colors.ts) |
| CSS variables / Tailwind `@theme` output | [apps/web/src/export.ts](apps/web/src/export.ts) |
| Saving/loading the board (IndexedDB, autosave) | [apps/web/src/storage.ts](apps/web/src/storage.ts) |
| Adding images (resize, read file) | [apps/web/src/image.ts](apps/web/src/image.ts) |
| Adding links (URL detection, call to API) | [apps/web/src/link.ts](apps/web/src/link.ts) |
| Link card look | [apps/web/src/LinkCard.tsx](apps/web/src/LinkCard.tsx) |
| Color picker fields | [apps/web/src/ColorFields.tsx](apps/web/src/ColorFields.tsx) |
| Landing page | [apps/web/src/landing.tsx](apps/web/src/landing.tsx) |
| Theme tokens, fonts, global CSS | [apps/web/src/index.css](apps/web/src/index.css) |
| shadcn UI primitives | [apps/web/src/components/ui/](apps/web/src/components/ui/) |
| API routes, CORS, rate limit | [apps/api/src/app.ts](apps/api/src/app.ts) |
| What the API reads from a page (title, cover, fonts, colors) | [apps/api/src/extract.ts](apps/api/src/extract.ts) |
| SSRF protection, safe HTTP fetch, redirects | [apps/api/src/fetch.ts](apps/api/src/fetch.ts) |
| Dev proxy, build pages, `@` alias | [apps/web/vite.config.ts](apps/web/vite.config.ts) |

## apps/web (React + Vite)

Two pages: `index.html` → `src/landing.tsx` (landing at `/`), `board/index.html` → `src/main.tsx` (board at `/board/`).

| File | What it does |
| --- | --- |
| `src/main.tsx` | Board entry. Loads the saved board, starts autosave, renders `App`. |
| `src/App.tsx` | Board shell: canvas, toolbar, palette panel, empty state, notices. Window-level paste (image/URL/text) and undo/redo keys. |
| `src/Canvas.tsx` | The infinite canvas. Wheel pan, Ctrl+wheel zoom, background drag, file/link drop. Renders every `ElementView`. |
| `src/ElementView.tsx` | One element on the board: selection, drag, resize/rotate handles, keyboard actions, note editing, color popover. |
| `src/LinkCard.tsx` | Content of a link element: cover, title, domain, fonts and colors. |
| `src/ColorFields.tsx` | Hex input + native color input used in the color popover. |
| `src/Toolbar.tsx` | Floating bottom toolbar: add image/note/color, undo/redo, selected-element actions (duplicate, layers, delete), zoom, palette toggle. |
| `src/PalettePanel.tsx` | Side panel with the board palette and fonts; copy as CSS or Tailwind. |
| `src/store.ts` | Zustand store: elements (array order = z-order), selection, view, undo history, palette metadata. |
| `src/storage.ts` | IndexedDB load/save, debounced autosave subscribed to the store. |
| `src/colors.ts` | `normalizeHex`, `buildPalette` (colors from swatches, links, images + user meta), `boardFonts`, `dominantColors`. |
| `src/export.ts` | `exportTheme('css' \| 'tailwind', colors, fonts)` and slug naming. |
| `src/geometry.ts` | Box math: rotate, resize with aspect lock, rotation snap, zoom around a point. |
| `src/drag.ts` | Pointer-drag helper used by move/resize/rotate. |
| `src/image.ts` | Read an image file into a data URL and add it to the board. |
| `src/link.ts` | `asUrl`, `addLink`: calls `GET /read`, samples the cover's colors, adds a link card. |
| `src/landing.tsx` | Marketing landing page with the animated demo board. |
| `src/index.css` | Tailwind import, theme tokens, fonts. |
| `src/lib/utils.ts` | `cn()` class helper (shadcn). |
| `src/components/ui/*` | shadcn components: button, empty, field, input, kbd, label, popover, separator, tooltip. |
| `src/*.test.ts` | Vitest: colors, export, geometry, store. |
| `components.json` | shadcn config. |
| `.env.example` | `VITE_API_URL`. |

## apps/api (Fastify, Node 24, no build)

| File | What it does |
| --- | --- |
| `src/server.ts` | Entry: builds the app and listens (`PORT`, `TRUST_PROXY`). |
| `src/app.ts` | `buildApp()`: `GET /health`, `GET /read?url=`, CORS header, in-memory rate limit per IP. |
| `src/extract.ts` | `readLink()`: fetches the page, parses title/cover from HTML, reads fonts and colors from stylesheets, returns cover as a data URL. |
| `src/fetch.ts` | `safeFetch()`: public http(s) only, ports 80/443, blocks private IPs at DNS lookup, re-checks each redirect, size and time caps. |
| `src/*.test.ts` | `node --test`: app routes and link reading with a fake fetcher. |
| `Dockerfile` | Production image (`node src/server.ts`). |
| `.env.example` | `CORS_ORIGIN`, `TRUST_PROXY`. |

## Repo root

| Path | What |
| --- | --- |
| `README.md` | Overview, how to run, shortcuts. |
| `PRD.md` | Product spec and v1 scope. |
| `CLAUDE.md`, `docs/agents/` | Instructions for coding agents (issue tracker, labels, domain docs). |
| `.scratch/<feature>/` | Local markdown issues. |
| `.claude/launch.json` | Dev server configs (`web`, `api`). |
| `.agents/`, `.claude/skills/`, `skills-lock.json` | Installed agent skills. |
| `pnpm-workspace.yaml` | Workspace: `apps/*`. |
