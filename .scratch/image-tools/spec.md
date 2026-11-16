# Basic image tools

Status: needs-triage

Crop, flip, grayscale, opacity and lock for image elements. These are table stakes in reference-board tools.

## Notes

- Prefer non-destructive: store the crop rect and flags on the element, apply at render and export.
- Lock should apply to any element type, not just images.
- Each change must go through undo.
