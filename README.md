# Lino

A moodboard that turns inspiration into a design starting point. Drop images, links, notes and colors on a board; Lino pulls a palette and fonts out of them and exports them as CSS variables or a Tailwind v4 `@theme`. No account: the board lives in your browser.

Product spec: [PRD.md](PRD.md). Where things live in the code: [MAP.md](MAP.md).

## Stack

pnpm workspace with two apps:

| App | What | Tech |
| --- | --- | --- |
| `apps/web` | Landing page at `/`, the board at `/board/` (two Vite pages) | React 19, Vite, Tailwind v4, shadcn (Base UI), Zustand, IndexedDB |
| `apps/api` | Reads a link's title, cover, fonts and colors for link cards | Fastify 5 on Node 24, run as TypeScript directly (type stripping, no build step) |

## Run

Needs Node 24 and pnpm.

```bash
pnpm install
pnpm dev        # web on :5173, api on :3000
pnpm typecheck
pnpm test       # vitest (web), node --test (api)
pnpm build
```

In dev, the web app calls `/api`, which Vite proxies to `:3000`.

## Environment

Copy the examples to `.env` (both are optional in dev):

- `apps/web/.env.example`: `VITE_API_URL`, the API address (defaults to `/api`).
- `apps/api/.env.example`: `CORS_ORIGIN`, the web origin allowed to call the API; `TRUST_PROXY=1` when behind a proxy such as Render, so rate limits see the real client IP.

## API

- `GET /health` → `{ ok: true }`
- `GET /read?url=` → `{ url, title, image, fonts, colors, missing }` (`image` is a data URL) for a public page.

`/read` only fetches public http(s) addresses on ports 80/443. The address is checked again on every redirect and pinned at DNS lookup, so DNS rebinding can't reach internal hosts. It has an 8 s budget, size caps and a limit of 30 reads per minute per IP. Deploy with `apps/api/Dockerfile`.

## Board shortcuts

| Action | Keys |
| --- | --- |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` |
| Move selected | Arrows (`Shift` ×10) |
| Delete / duplicate | `Delete` / `Ctrl+D` |
| Layer down / up | `[` / `]` (`Ctrl` for back / front) |
| Edit note, open color picker, open link | `Enter` (or double-click) |
| Pan / zoom | Wheel or drag the background / `Ctrl` + wheel |
| Resize with aspect lock toggled | `Shift` while resizing |
| Snap rotation to 15° | `Shift` while rotating |

Paste or drop images, links (they become cards with cover, title, fonts and colors) or text (becomes a note). The palette button opens the board palette: rename, pin or hide colors, see the fonts found, and copy everything as CSS or Tailwind.
