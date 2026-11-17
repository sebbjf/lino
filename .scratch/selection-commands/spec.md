# Selection commands in one place

Status: ready-for-agent

Origin: architecture review, candidate 3 ([overview](../architecture-review/spec.md)). Not grilled yet: the decisions below are proposals.

## Problem

- Nudge by arrow keys is written twice: `ElementView.onKeyDown` (focused element) and the window handler in `App.tsx` (nothing focused). Both build the same `moveMany(Object.fromEntries(elements.filter(...).map(...)))`. Delete and duplicate are split the same way. `MAP.md` records the split as a map entry, which is a sign it is a trap.
- "Which elements does this act on" is `group()` inside the component (the selection if the element is in it, else just this one). The window handler re-derives the same idea from `selectedIds`.
- `readOnly` gating is re-checked in each branch (`ElementView` once, `App` four times). Missing one lets a shared board be edited.

## Proposal

A selection-commands module: nudge, remove, duplicate, rotate-step, reorder, each taking the target and honouring read-only once. The two key handlers shrink to "key to command". Toolbar buttons call the same commands.

## Benefits

- Locality: one read-only check, one nudge.
- Leverage: Toolbar, keyboard and any future command palette share the commands.
- Tests: nudge, rotate-step wrap-around (`((deg+180)%360+360)%360-180`) and read-only refusal become plain store-level tests; today they sit inside a React key handler with no test.

## Open questions for the grilling

- Are commands functions on the store or a separate module over it?
- Where does "the target" (selection vs the focused element) get decided?
- Depends loosely on [undo-history](../undo-history/spec.md): commands need a clear "one step" story.

## Order (2026-11-17)

Decided to come after `image-storage` and before `undo-history`. Not grilled yet.

## Decisions (2026-11-17, grilling)

- A separate module `selection.ts` of plain functions over the store: `nudge`, `remove`, `duplicate`, `rotateStep`, `reorder`. The read-only check lives once there. Store actions stay ungated (import, undo, drag and the shared view use them). Lock (`image-tools`) will plug into the same gate later; nothing built for it now.
- One helper `targetOf(focusedId?)`: the selection if the focused element is in it, else just that element. Replaces `group()` in `ElementView` (the name clashes with the future Group). Commands take explicit ids.
- Out of scope: Alt+arrow resize, Ctrl+Alt+C/V style copy/paste.
- Each command calls `checkpoint()` once. Coalescing held arrow keys belongs to `undo-history`.
- Behaviour change: `R` / `Shift+R` rotates every element of the target 15° about its own centre (wrap-around kept) and works with nothing focused. Reorder stays single-element, only moved and gated.
- Tests, store level in `selection.test.ts`: nudge moves only the target (1, or 10 with Shift); every command is a no-op on a read-only board (state unchanged, no checkpoint); rotate wraps (170+15 gives -175, -170-15 gives 175); `targetOf` rule; remove and duplicate act on the target.
- Commits: 1 `selection.ts` + tests, 2 the two key handlers become key-to-command, 3 toolbar Delete, Duplicate and reorder call the commands.

Status: ready-for-agent.
