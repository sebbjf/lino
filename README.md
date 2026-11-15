# Lino

A moodboard that turns inspiration into a design starting point. See [PRD.md](PRD.md).

## Run

```bash
pnpm install
pnpm dev        # web on :5173, api on :3000
pnpm typecheck
pnpm test
```

- `apps/web`: React + Vite + Tailwind + Zustand. Landing page at `/`, the board at `/board/` (two Vite pages). The board lives in IndexedDB, no account.
- `apps/api`: Fastify, run directly as TypeScript by Node 24 (type stripping, no build step). `GET /read?url=` reads a page's title, cover, fonts and colors for link cards. It only fetches public http(s) addresses on ports 80/443 (checked again on every redirect and pinned at DNS lookup, so rebinding can't reach internal hosts), with an 8 s budget, size caps and 30 reads per minute per IP.

Env: `VITE_API_URL` (web, defaults to `/api`, proxied to :3000 in dev), `CORS_ORIGIN` and `TRUST_PROXY=1` (api, behind a proxy such as Render).

## Board shortcuts

`Ctrl+Z` undoes, `Ctrl+Shift+Z` or `Ctrl+Y` redoes. Select an element (click or Tab), then: arrows move it (Shift ×10), `Delete` removes it, `Ctrl+D` duplicates,
`[` / `]` move it a layer down/up (`Ctrl` for back/front), `Enter` edits a note or opens the color picker (also by clicking its hex label). Paste or drop a link to get a card with its cover, title, fonts and colors; `Enter` or double-click opens it. The palette button opens the board palette: rename, pin or remove colors, see the fonts found, and copy everything as CSS variables or a Tailwind v4 `@theme`.
Wheel pans, `Ctrl` + wheel zooms, dragging the background pans. Shift while resizing toggles aspect lock, while rotating snaps to 15°.
