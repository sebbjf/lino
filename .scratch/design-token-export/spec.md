# From moodboard to design tokens

Status: done (type specimen left for element-kinds)

This is the differentiator: Lino already exports CSS and Tailwind (`apps/web/src/export.ts`).

- Export in the W3C Design Tokens format, as Figma variables, and as `.ase` swatches.
- WCAG contrast check between palette pairs.
- A "type specimen" element to try the detected fonts on the board.

## Notes

- Every exporter writes user-controlled names and values: sanitize at the sink, as `export.ts` now does.

## Comments

2026-11-16: W3C Design Tokens JSON shipped as a third export format (`tokens` in `apps/web/src/export.ts`, "Tokens" in the palette panel). Left open: Figma variables, `.ase` swatches, WCAG contrast check, type specimen element.

2026-11-19 grilled. Decisions for this round:
- In: WCAG contrast pairs, tone scales 50-900, `.ase` download. Out: type specimen element (it is a fifth element kind; do it with `element-kinds` / `frames-and-groups`).
- Figma variables: no separate format. Figma imports W3C Design Tokens JSON natively, so the "Tokens" export covers it; the panel hint says so.
- Tone scales: one global "Tone scales" toggle in the export prefs (persisted with the other export prefs). When on, every palette colour exports as `name-50` .. `name-900` (CSS, Tailwind, Tokens) instead of one value. Scale is built in OKLCH, keeping the colour's hue and chroma (chroma clamped into sRGB).
- Contrast: a list in the palette panel of palette pairs whose WCAG ratio is >= 3, best first, each with an "Aa" sample, the ratio and AA-large / AA / AAA badge.
- `.ase`: a "Download .ase" button next to Copy; Adobe Swatch Exchange v1.0, RGB float, one normal (non-global) swatch per palette colour with its name.

2026-11-19 shipped: `contrast.ts` (pairs >= 3:1, levels from the raw ratio, shown ratio floored), `toneScale` in `style.ts` + `scales` export pref (tone names go through the same unique-name pass; colours with alpha skip the scale; tokens nest `base` + steps under a group), `ase.ts` + "Download .ase". Checked in the browser: contrast list, toggle, tokens output.
