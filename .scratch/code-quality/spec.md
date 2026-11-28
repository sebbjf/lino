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
| ~~`ElementView`~~ | ~~82~~ → 40 | `apps/web/src/components/ElementView.tsx` | **Done** (`6542f27`, `f9d5bd0`): `openAction` in `board/open.ts`, `runElementKey` in `board/keys.ts`, `Handles`, `startMove`, `readElementKey`, `useElementFocus`. A first try reached 24 by moving JSX into single-use helpers with 7-9 pass-through params; those were inlined back. |
| ~~`App`~~ | ~~60~~ → 21 | `apps/web/src/App.tsx` | **Done** (`64bec3e`): `pasteAction` in `board/paste.ts`, `boardKey` in `board/keys.ts`, `ReadOnlyBanner` and `EmptyBoard`. |
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

## 3. ub-mode quality gates

Targets: CRAP < 10 per function, no duplication ranked 0.8 or above, no surviving mutants.

### Results (2026-11-28, at `338724b`)

- **dryer**: clean. All 79 pairs at 0.8 or above are inside `components/ui/` (vendored shadcn, leave); none in project code.
- **crapper**: 82 of 394 functions at CRAP ≥ 10 (shadcn excluded). 63 of them are at 0% coverage: almost all React components, because the web app has no component tests. The other 19 are covered but complex, mostly key/command tables (`boardKey` 24, `parseHtml` 19, `buildPalette` 15, `runElementKey` 14, `checkUrl` 14, `snapMove` 13, `findFonts` 13); ub-mode says to weigh whether a case table is worth splitting. Getting the 63 under 10 means either component tests (needs a DOM test setup, a decision of its own) or keeping on moving decisions out of components into tested pure modules, which is what items 1 and 2 do.
- **mutator**: run on the modules this pass touched (`board/open.ts`, `board/paste.ts`, `board/keys.ts`): 41 of 42 killed (97.6%). The one survivor, `keys.ts:87` `?? null` → `|| null`, is equivalent (every lookup returns an object or `undefined`), so no test can kill it. Not yet run on the rest of the tree; the first full run executes every covered mutant and takes long.

### How to run them on Windows

The tools are Python (`git clone` all three side by side; mutator imports `../crapper`). The launchers expect `.venv/bin`, so make one venv and install all three into it: `python -m venv .venv && .venv/Scripts/python -m pip install -e ./crapper -e ./dryer -e ./mutator`. Then from the repo root:

- `python -m dryer --threshold 0.8 apps/web/src apps/api/src`
- **crapper**: its coverage step spawns `npx`/`npm`, which fails on Windows (`WinError 2`, they are `.cmd`), and it only reads LCOV from the repo root. Generate it yourself, then rewrite paths with `lcov_fix.py` (this folder) and run with existing coverage:
  - `cd apps/web && npx vitest run --coverage --coverage.reporter=lcov` (`@vitest/coverage-v8` is a dev dependency since `338724b`)
  - `cd apps/api && mkdir -p coverage && node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=coverage/lcov.info`
  - `python lcov_fix.py <repo>` then `python -m crapper --use-existing-coverage apps/web/src apps/api/src`
- **mutator**: its workers link the tree with symlinks, which Windows refuses without Developer Mode (`WinError 1314`). `patch_mutator.py` (this folder) patches `workers.py` to use junctions for directories and copies for files, and makes every link check junction-aware so cleanup never recurses into the real tree. Even so, run it on a throwaway `git worktree` (with its own `pnpm install`), never on the main checkout, and pass a test command: `python -m mutator --no-coverage --test-command "pnpm.cmd --dir apps/web exec vitest run src/board" <files>`. Delete the worktree with a link-safe delete (pnpm's `node_modules` is junctions into the global store) and the `\\?\` long-path prefix.

`.metrics/` and `target/` (tool output) are in `.gitignore`.

## 4. ~~Not pushed~~

Done: the first pass was pushed with `a15ec7c`. The commits since then are local.
