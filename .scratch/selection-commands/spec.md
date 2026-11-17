# Selection commands in one place

Status: needs-triage

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
