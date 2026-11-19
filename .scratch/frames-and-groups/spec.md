# Frames, groups and headings

Status: done

Done 2026-11-19: `frame` kind (kinds/frame.ts, pure logic in frames.ts), `groupId` + Ctrl+G / Ctrl+Shift+G, note `heading` style, "Add frame" / "Frame selection" (Ctrl+Alt+F) / "Add heading" in the toolbar. Frames render behind everything at render time (and in the PNG).

## Problem

A board with 50 elements is a pile: there is no way to section it.

## Idea

- Frames / sections with a title that move their contents with them.
- Group and ungroup a selection.
- Text headings (larger than notes, no card).

## Notes

- Arrange/mosaic should be able to act inside a frame.
- Out of scope: arrows and connectors (see roadmap non-goals).

## Comments

2026-11-19 grilled:
- Frame = new element kind `frame` (title + rectangle, drawn behind other elements). Membership is geometric: dragging a frame moves the elements whose centre is inside it at drag start. No membership field. Arrange can act on a frame's contents.
- Groups: elements get an optional `groupId`. Ctrl+G groups the selection, Ctrl+Shift+G ungroups; clicking any member selects the whole group. One undo step each.
- Headings: a note style (no card, large size), not a new kind.
