# From moodboard to design tokens

Status: needs-triage

This is the differentiator: Lino already exports CSS and Tailwind (`apps/web/src/export.ts`).

- Export in the W3C Design Tokens format, as Figma variables, and as `.ase` swatches.
- WCAG contrast check between palette pairs.
- A "type specimen" element to try the detected fonts on the board.

## Notes

- Every exporter writes user-controlled names and values: sanitize at the sink, as `export.ts` now does.

## Comments

2026-11-16: W3C Design Tokens JSON shipped as a third export format (`tokens` in `apps/web/src/export.ts`, "Tokens" in the palette panel). Left open: Figma variables, `.ase` swatches, WCAG contrast check, type specimen element.
