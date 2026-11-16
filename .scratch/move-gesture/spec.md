# Move gesture as a module

Status: needs-triage

Origin: architecture review, candidate 5 ([overview](../architecture-review/spec.md)). Speculative: only do this if drag bugs keep showing up. Not grilled yet.

## Problem

`snapMove` (geometry.ts) is pure and tested, but the bugs live in how it is called. About 25 lines in `ElementView.onPointerDown` decide group vs single, Shift toggle, Alt disables snapping, a second finger reverts the move, guides clear on release, and a checkpoint opens the undo step. That wiring has no test. Pinch handling is split across a module-global `touches` map in `drag.ts` that `Canvas.tsx` also writes to.

## Proposal

A move-gesture module that takes the moving elements, the others and the zoom, and yields positions and guides per pointer delta. The component only forwards pointer events and writes results to the store.

## Benefits

- Tests: "pinch reverts the move", "Alt skips snapping" and "group moves together" become unit tests.

## Caveat

The gesture rarely changes now, and the touch state couples to `Canvas`. Depends on [undo-history](../undo-history/spec.md) for the checkpoint story.
