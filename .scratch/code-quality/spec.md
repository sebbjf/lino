# Code quality: what is left

Status: ready-for-agent

The first pass (16 commits on `main`, ending at `ce0af9a`, not pushed) split the long functions in the board logic, PNG export, storage, toolbar, style menu, palette panel and landing page, each behind a test written first. This file lists what that pass did not reach.

How each item is done: pin the current behaviour with a test, change the structure, prove the test still passes (`pnpm -r typecheck`, `pnpm -r test`), check UI changes in the browser, one commit per item.

## Measure

`cc.mjs` in this folder prints the cyclomatic complexity of every top-level function, using `@babel/parser` from `node_modules` (TypeScript 7 has no JS API). Run it from the repo root in Git Bash:

```sh
p="$(cygpath -m "$PWD")/node_modules/.pnpm/@babel+parser@7.29.14/node_modules/@babel/parser/lib/index.js"
node .scratch/code-quality/cc.mjs "$p" "$(cygpath -m "$PWD")/apps/web" src
node .scratch/code-quality/cc.mjs "$p" "$(cygpath -m "$PWD")/apps/api" src
```

`MIN=5` lowers the reporting threshold (default 10). It counts complexity only, not coverage, so it gives no CRAP score.

## 1. Components still above complexity 10

Most of the count comes from handlers and derived state written inside the component. The fix is the same as for `keys.ts` and `move.ts`: move the decision into a pure function with a test, and leave the component to wire events to it.

| Function | CC | File | What to pull out |
| --- | --- | --- | --- |
| `ElementView` | 82 | `apps/web/src/components/ElementView.tsx` | `open()` (what double-click/Enter does per kind) as a pure `openAction(el, readOnly)`; resize/rotate handlers into a small hook; the handles JSX into a `Handles` component. |
| `App` | 60 | `apps/web/src/App.tsx` | The paste handler as `pasteAction(text, files)` (image, colour, link or note) and the window keys as `boardKey(e, onBody, hasSelection)` returning a command id, both in `board/keys.ts` with tests; the read-only banner and the empty states into their own components. |
| `ElementPanel` | 39 | `apps/web/src/components/StyleMenu.tsx` | The `cur`/`allNotes`/`allImages` derivation as a pure function over the selected elements; split into `ImageControls` and `NoteControls`. |
| `Canvas` | 37 | `apps/web/src/components/Canvas.tsx` | Wheel pan/zoom and pinch maths into pure functions next to `viewport.ts`; the drop handler's "what was dropped" decision as a pure function. |
| `PalettePanel` | 32 | `apps/web/src/components/PalettePanel.tsx` | Split into `ColorList`, `ContrastList` and `ExportSection`; move the inline shuffle callback into the store or a helper. |
| `CommandMenu` | 24 | `apps/web/src/components/CommandMenu.tsx` | List keyboard navigation as a pure function. |

`useBoard` (33) in `store.ts` is many small actions in one object, so its count is a sum, not one tangled function; leave it.

Others between 10 and 15, lower priority: `CropOverlay`, `toElement` and `colorMetaOf` (`data/snapshot.ts`), `NoteBody`, `useCrop`, `Stage` (`landing/HeroStage.tsx`), `buildPalette`, `snapMove`, `backfillColors`, `BoardsMenu`, `ContextMenu`, `ShareButton`, `ImageBody`, `movingSet`, `FieldError` (shadcn, leave), `addLink`, `pushHistory`.

## 2. api

| Function | CC | File |
| --- | --- | --- |
| `parseHtml` | 19 | `apps/api/src/extract.ts` |
| `checkUrl` | 14 | `apps/api/src/fetch.ts` |
| `findFonts` | 13 | `apps/api/src/extract.ts` |

All three are covered by `read.test.ts` / `routes.test.ts`. `checkUrl` guards against SSRF: change it only behind its existing tests, and do not loosen any check. Small win: `routes.ts` writes `max-age=3600` where `HOUR_MS` exists.

## 3. ub-mode quality gates never ran

`crapper`, `dryer` and `mutator` (github.com/unclebob) support TypeScript but were not installed: auto mode denied creating their Python virtualenv. To run them, allow that install, then from the repo root run each tool. On Windows the launcher scripts expect `.venv/bin`; create the venv by hand and use `.venv/Scripts/python -m crapper` instead. crapper wants coverage: for the Vitest app it installs `@vitest/coverage-v8` into `node_modules` without editing `package.json`.

Targets: CRAP < 10 per function, no duplication ranked 0.8 or above, no surviving mutants.

## 4. Not pushed

The 16 commits from the first pass are only on the local `main`.
