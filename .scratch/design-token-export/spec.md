# From moodboard to design tokens

Status: needs-triage

This is the differentiator: Lino already exports CSS and Tailwind (`apps/web/src/export.ts`).

- Export in the W3C Design Tokens format, as Figma variables, and as `.ase` swatches.
- WCAG contrast check between palette pairs.
- A "type specimen" element to try the detected fonts on the board.

## Notes

- Every exporter writes user-controlled names and values: sanitize at the sink, as `export.ts` now does.
