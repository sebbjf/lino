# Minor cleanups from the audits

Status: ready-for-agent

- [ ] **Board names repeat**: `createBoard` names `Board ${boards.length + 1}` and `importShared` always "Shared board" (`apps/web/src/data/storage.ts`).
- [ ] **Delete vs. pending autosave** (`deleteBoard` still swallows errors): a scheduled autosave can rewrite a board just deleted, leaving an orphan record; `deleteBoard` also swallows delete errors (`storage.ts`).
- [ ] **Read-only palette is editable**: rename, pin and remove work in the shared view (`PalettePanel.tsx`).
- [ ] **`switchBoard`/`createBoard`** do not catch read errors (`storage.ts`).
- [ ] **`shadcn` is in `dependencies`** of `apps/web` but only `shadcn/tailwind.css` is used; move to devDependencies. `pnpm audit` reports 3 dev-only advisories (esbuild via drizzle-kit, minimatch and deepmerge via shadcn).
- [ ] **`apps/api/Dockerfile`** installs without a lockfile; **CI actions** are pinned by tag, not SHA.
- [ ] **Focus ring contrast**: `ring-ring/50` was fixed only in `App.tsx`; the boards trigger and landing/404 pills still use it.
- [ ] **ErrorBoundary** in `main.tsx` was never exercised with a forced render error.

Checked 2026-11-17 against `main` (b4508e0): none of the eight is done. `switchBoard`/`createBoard` read errors and the ErrorBoundary test were not re-verified, so they stay open.
