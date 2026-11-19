# Basic image tools

Status: ready-for-agent

Crop, flip, grayscale, opacity and lock for image elements. These are table stakes in reference-board tools.

## Notes

- Prefer non-destructive: store the crop rect and flags on the element, apply at render and export.
- Lock should apply to any element type, not just images.
- Each change must go through undo.

## Comments

2026-11-19 grilled:
- Crop mode with handles: a Crop button (and double click on an image) enters crop mode, drag the edges, Enter/click outside confirms, Esc cancels. Non-destructive `crop` rect (fractions of the source) on the element, applied in render and PNG export.
- Flip horizontal / vertical as style flags.
- Grayscale and opacity already exist (mono filter, opacity style).
- Lock: `locked?: boolean` on any element. Locked elements cannot be dragged, resized, rotated, nudged or deleted; the check lives in selection.ts and the drag path. Unlock from the style menu / toolbar.
