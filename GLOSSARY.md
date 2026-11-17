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
A board snapshot written out as a `.lino.json` file that can be imported again.
_Avoid_: Export, backup

**Shared board**:
A read-only copy of a board snapshot reachable by a link, which stops working after 90 days.
_Avoid_: Published board, public board

**Selection**:
The elements a person has picked to act on together (move, rotate, duplicate, delete). A command acts on the selection, or on the one element it was aimed at if that element is not in it.
_Avoid_: Group (reserved for the future grouping feature)

**Undo step**:
One change to a board snapshot that Undo reverts at once: a drag, a paste of several images, a palette edit. A burst of the same repeatable edit (a held arrow key, typing a color name, scrubbing the board color) counts as one.
_Avoid_: Action, history entry
