# Lino

A moodboard tool: people collect images, notes, colors and links on an infinite canvas and take the palette out as design tokens.

## Language

**Board**:
One canvas of elements with its own name, background and palette edits.
_Avoid_: Canvas, project, moodboard

**Element**:
One thing placed on a board: an image, a note, a color swatch or a link card.
_Avoid_: Item, card, object

**Board snapshot**:
The portable content of a board: its elements, palette edits and board style. It is self-contained (its images travel with it), carries no viewport and no per-device preferences, and is what a board file, a shared board and a saved local board all have in common.
_Avoid_: Board data, board state, save

**Board file**:
A board snapshot written out as a `.lino.json` file that can be opened again. Its format is specified in `docs/file-format.md`.
_Avoid_: Export, backup

**Linked file**:
The board file a board saves to with Save (Chrome and Edge). The board in the browser stays the source of truth and keeps autosaving; the linked file only changes on Save, and a dot marks changes not yet in it. Lino never renames or deletes a linked file.
_Avoid_: Synced file, source file

**Shared board**:
A read-only copy of a board snapshot reachable by a link, which stops working after 90 days.
_Avoid_: Published board, public board

**Selection**:
The elements a person has picked to act on together (move, rotate, duplicate, delete). A command acts on the selection, or on the one element it was aimed at if that element is not in it.
_Avoid_: Group (that is a different thing, below)

**Group**:
Elements that share a `groupId`: picking one picks them all, so they move, rotate and delete together. Ctrl+G makes one from the selection, Ctrl+Shift+G dissolves it.
_Avoid_: Selection, frame

**Frame**:
A titled rectangle drawn behind everything else. It stores no members: the elements whose centre is inside it when a drag starts move with it, and Arrange on a lone frame lays out what is inside it.
_Avoid_: Group, section, container

**Undo step**:
One change to a board snapshot that Undo reverts at once: a drag, a paste of several images, a palette edit. A burst of the same repeatable edit (a held arrow key, typing a color name, scrubbing the board color) counts as one.
_Avoid_: Action, history entry
