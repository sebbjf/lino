# Undo history owned by the store

Status: done (bad8e0a and review fixes)

Origin: architecture review, candidate 2 ([overview](../architecture-review/spec.md)). Not grilled yet: the decisions below are proposals.

## Problem

- `addImages` (image.ts) adds N images, arranges them, moves them, then edits history by hand: `useBoard.setState({ past: past.at(-1) === elements ? past : [...past, elements] })`. It knows `past` is a stack of whole `elements` arrays and that `add` and `arrange` each push one.
- The interface has an ordering rule callers must remember: call `checkpoint()` first (`restyle`, `pasteStyle`, every drag, nudge and picker open). It appears 8+ times in `ElementView.tsx`; a forgotten call silently makes a gesture un-undoable.
- `update`, `moveMany` and `restyle` push no history; `add`, `remove`, `arrange` do. Which is which is only visible by reading the bodies.

## Proposal

Make "one undo step" a concept the store owns: a way to run several store operations as a single step, so callers never touch `past` or `future`. Gestures and batch adds both use it.

## Benefits

- Locality: history invariants (limit of 100, dedupe of unchanged snapshots, redo clearing) sit next to the code that depends on them.
- Leverage: `addImages`, future bulk imports and gestures share one mechanism.
- Tests: `store.test.ts` can assert "adding 3 images then undo leaves an empty board" through the store interface.

## Open questions for the grilling

- Does `checkpoint()` stay for gestures, or does everything become a scoped batch?
- Should `update`, `moveMany` and `restyle` stay history-free by default?
- Interaction with board snapshot `open` (replace = one undo step): see [board-snapshot](../board-snapshot/spec.md).

## Decisions so far (2026-11-17, grilling; still not fully grilled)

- One undo step is a change to the board snapshot (elements, palette edits, board style). Viewport and per-device preferences are not undoable. Importing a board file is one step.
- History is per board, in memory only, and cleared on reload or when switching boards.
- Order: after `image-storage` and `selection-commands`. Open: how steps batch (drag, typing in a note) and the interaction with two tabs overwriting each other (`audit-followups`).
- Constraint from `image-storage`: undo may restore a deleted image, so blobs are never released mid-session (see `docs/adr/0002`).

- From `selection-commands`: every command makes exactly one checkpoint, so a held arrow key makes one undo step per key repeat. How to coalesce is open here.
## Decisions (2026-11-17, grilling, round 2)

- A history entry is the whole snapshot: `{ elements, colorMeta, board }`, unchanged parts shared by reference. Undo and redo restore all three; palette actions (pin, hide, rename, board style) push steps. Importing a board file undoes fully.
- `checkpoint()` stays for continuous gestures; new `step(fn)` runs several store operations as one undo step (`addImages` uses it). No UI code touches `past` or `future`.
- `update`, `moveMany` and `restyle` stay history-free (they run many times per second); documented on each.
- `checkpoint(key)` coalesces: skipped when the previous checkpoint had the same key less than 600 ms ago. Used by nudge and rotate (key includes the ids), the palette rename field and board style. Other commands stay one step per call.
- Two tabs overwriting each other is out of scope (`audit-followups` 02). History stays per tab, in memory.
- Defaults taken without a question: tests at the store interface (palette and board style undo, `step`, coalescing with fake timers, redo cleared by a new step); commits 1 snapshot-shaped history, 2 `step` and `addImages`, 3 coalescing; glossary gets **Undo step**.
