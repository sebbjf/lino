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
- `apps/api`: Fastify, run directly as TypeScript by Node 24 (type stripping, no build step).

## Board shortcuts

`Ctrl+Z` undoes, `Ctrl+Shift+Z` or `Ctrl+Y` redoes. Select an element (click or Tab), then: arrows move it (Shift ×10), `Delete` removes it, `Ctrl+D` duplicates,
`[` / `]` move it a layer down/up (`Ctrl` for back/front), `Enter` edits a note or opens the color picker (also by clicking its hex label). The palette button opens the board palette: rename, pin or remove colors.
Wheel pans, `Ctrl` + wheel zooms, dragging the background pans. Shift while resizing toggles aspect lock, while rotating snaps to 15°.
