# Lino

A moodboard that turns inspiration into a design starting point. Drop images, links, notes and colors on a board; Lino pulls a palette and fonts out of them and exports them as CSS variables or a Tailwind v4 `@theme`. No account: the board lives in your browser.

Product spec: [PRD.md](PRD.md). Where things live in the code: [MAP.md](MAP.md).

## Stack

pnpm workspace with two apps:

| App | What | Tech |
| --- | --- | --- |
| `apps/web` | Landing page at `/`, the board at `/board/` (two Vite pages) | React 19, Vite, Tailwind v4, shadcn (Base UI), Zustand, IndexedDB |
| `apps/api` | Reads links for link cards; stores shared boards | Fastify 5 on Node 24, run as TypeScript directly (type stripping, no build step), Postgres + Drizzle |

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

Sharing needs Postgres. Locally, with Docker Desktop running:

```bash
docker compose up -d   # Postgres 17 on :5432 (user/password/db: lino)
```

Then set `DATABASE_URL` in `apps/api/.env` (see the example). The API applies migrations from `apps/api/drizzle/` on start. Without `DATABASE_URL` everything else works and sharing answers 503. After changing `apps/api/src/schema.ts`, run `pnpm --filter @lino/api exec drizzle-kit generate`.

## Environment

Copy the examples to `.env` (both are optional in dev):

- `apps/web/.env.example`: `VITE_API_URL`, the API address (defaults to `/api`).
- `apps/api/.env.example`: `CORS_ORIGIN`, the web origin allowed to call the API; `TRUST_PROXY=1` when behind a proxy such as Render, so rate limits see the real client IP; `DATABASE_URL` for shared boards.

## API

- `GET /health` → `{ ok: true }`
- `GET /read?url=` → `{ url, title, image, fonts, colors, missing }` (`image` is a data URL) for a public page.
- `POST /boards` with `{ elements, colorMeta }` → `201 { id, expiresAt }`. Stores a fixed snapshot for 90 days. Max 5 MB, 300 elements, 20 shares per hour per IP.
- `GET /boards/:id` → the snapshot, or 404 when unknown or expired.

Shared boards are rendered in other people's browsers, so the body schema is strict: images must be `data:image/…` URLs, links must be http(s), colors must be hex, unknown fields are dropped. The 12-character id is random (72 bits) and is the only key.

`/read` only fetches public http(s) addresses on ports 80/443. The address is checked again on every redirect and pinned at DNS lookup, so DNS rebinding can't reach internal hosts. It has an 8 s budget, size caps and a limit of 30 reads per minute per IP. Deploy with `apps/api/Dockerfile`.

## Board shortcuts

| Action | Keys |
| --- | --- |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` or `Ctrl+Y` |
| Select several | `Shift`+click, `Shift`+drag on the background (selection box), `Ctrl+A` for all; `Esc` clears |
| Align / distribute | Toolbar buttons with 2+ selected (distribute needs 3+); aligns visible outlines, rotation included |
| Align while dragging | Snaps to other elements' edges and centers with guide lines; hold `Alt` to move freely |
| Move selected (whole selection) | Arrows (`Shift` ×10), or drag any selected element |
| Resize selected | `Alt` + arrows (`Shift` ×10) |
| Rotate selected 15° | `R` / `Shift+R` |
| Delete / duplicate (whole selection) | `Delete` / `Ctrl+D` |
| Layer down / up | `[` / `]` (`Ctrl` for back / front) |
| Edit note, open color picker, open link | `Enter` (or double-click) |
| Pan / zoom | Wheel or drag the background / `Ctrl` + wheel |
| Resize with aspect lock toggled | `Shift` while resizing |
| Snap rotation to 15° | `Shift` while rotating |
| Move between toolbar buttons | `←` / `→`, `Home` / `End` |

Paste or drop images, links (they become cards with cover, title, fonts and colors) or text (becomes a note). The palette button opens the board palette: rename, pin or hide colors, see the fonts found, and copy everything as CSS or Tailwind.

**Download PNG** renders the whole board (not just what is on screen) at 2× with the current theme. It is drawn on a canvas, not screenshotted, so selection outlines never show up.

**Share** uploads a copy of the board and gives a read-only link (`/board/?s=<id>`). Later edits do not change it. The shared view can pan, zoom, open links and copy the palette, and never touches the viewer's own board.

## Accessibility

- Every board action has a keyboard path: Tab reaches each element (the view pans to it), and moving, resizing, rotating, layering, editing and deleting all have keys (above).
- The canvas is a labelled region whose description lists those keys for screen readers. Elements are labelled groups ("Color #aabbcc", "Link: title"). Notices use a polite live region.
- Text contrast is at least 5.2:1 in the theme (muted text included).
- `prefers-reduced-motion` turns off the landing animation, the demo loop and every transition/animation in the board.
