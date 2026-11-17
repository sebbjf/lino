# Board snapshot module

Status: done (2026-11-17). Notes: note text over 10 000 chars is cut on parse, not dropped, so loading a local save never loses a whole note; the phone fit now uses the default padding.

Origin: architecture review, candidate 1. Vocabulary in `GLOSSARY.md` (Board snapshot, Board file, Shared board). Interface vocabulary: module, interface, seam, adapter.

## Problem

Knowledge of the board snapshot is spread over several modules:

- The shape `{ elements, colorMeta, board, view? }` is spelled out in `exportBoardFile` (boardFile.ts), `shareBoard` (share.ts), `save` and `importShared` (storage.ts). The API schema in `apps/api/src/routes.ts` repeats the validation limits by comment ("same limits").
- The rule "a link still loading will never finish" is enforced three times with three messages: `storage.show` ("Reading was interrupted."), `shareBoard` ("Not read yet."), `toElement` ("Not read.").
- Putting a snapshot on screen happens three ways: `storage.show` (resets undo, selection, guides, fits on phones), `loadShared` (plain `setState`, no reset), `importBoardFile` (`replaceBoard` + `fitView`).
- `boardFile` imports `storage.createBoard`; `share` imports `boardFile.parseBoard`.

Adding a board field (as `board.messy` and `exportPrefs` were) means touching every one of these.

## Decisions

1. **Scope: web only.** No shared package with the API. Add one contract test on each side (web, api) pinning the shared limits: positions ±1e6, sizes 1..10 000, text max 10 000 chars.
2. **Contents.** A snapshot is the portable content: `elements`, `colorMeta`, `board`. `view` and `exportPrefs` are local-only; the IndexedDB record is the snapshot plus those two.
3. **One parse path.** Every adapter, including IndexedDB, goes through the same validating parse. Element ids are regenerated on load (undo and selection reset anyway). New element fields must be added to the parse, as already required for board files.
4. **Interface.** One module with three operations: capture a snapshot from the store, parse one from untrusted data, open one onto the screen. `open` takes a mode:
   - `replace`: into the current board, one undo step (today's import-into-empty-board behaviour).
   - `new`: as a new board, clean history, selection and guides.
   - `readonly`: shared view, clean history, selection and guides (fixes `loadShared` skipping the reset).
   `open` takes an optional view; with none it fits the content to the window. The phone rule ("never-moved board on a narrow screen opens fitted") stays in the local adapter, which passes no view in that case.
5. **Link repair in the parse only.** One wording: status `error`, message "Reading was interrupted.". Remove the extra passes in `shareBoard` and `storage.show`; the recipient's parse repairs the link.
6. **Adapters stay thin.**
   - Board file adapter (boardFile.ts): download, upload, `isBoardFile`. Keeps the policy "current board has elements, so open as `new`, otherwise `replace`" and the user-facing notices.
   - Share adapter (share.ts): the fetch calls, the 4 MB check, `sharedId`.
   - IndexedDB adapter (storage.ts): owns the board index, with one shared "read the index, or the default" helper. `importShared` becomes a method taking a snapshot and a name ("save as new local board").
7. **Tests.** Round-trip tests in Vitest against the store: capture, JSON, parse, open, compare, for each open mode. Existing parse tests in `boardFile.test.ts` move into the module's tests. The IndexedDB and download adapters stay thin and untested; no `fake-indexeddb` dependency.

## Out of scope

- A package shared between `apps/web` and `apps/api`.
- Changing the file format (`app: 'lino', version: 1`) or the share API body.
- Moving images out of data URLs (see `.scratch/image-storage/`).

## Acceptance

- The snapshot shape and the link-repair rule each appear in exactly one module.
- `loadShared`, `importBoardFile` and `storage.show` all open through the module's `open`; none touches `past`, `future`, `selectedIds` or `guides` directly.
- `boardFile.ts` no longer imports `storage.ts`; `share.ts` no longer imports `parseBoard` from `boardFile.ts`.
- Round-trip tests exist for `replace`, `new` and `readonly`, plus a test that a loading link comes back as an error.
- Contract tests on web and api fail if either side's limits change alone.
- `MAP.md` updated for the new file.
- `pnpm` tests and typecheck pass in both apps.
