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
The portable content of a board: its elements, palette edits and board style. It carries no viewport and no per-device preferences, and is what a board file, a shared board and a saved local board all have in common.
_Avoid_: Board data, board state, save

**Board file**:
A board snapshot written out as a `.lino.json` file that can be imported again.
_Avoid_: Export, backup

**Shared board**:
A read-only copy of a board snapshot reachable by a link, which stops working after 90 days.
_Avoid_: Published board, public board
