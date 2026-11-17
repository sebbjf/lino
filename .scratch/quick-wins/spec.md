# Quick wins

Status: needs-triage

Small features with visible impact, noted on 2026-11-16. None is implemented. Each should fit in one small change.

- **WCAG contrast in the palette**: next to each color, whether white or black text passes AA/AAA (and the ratio). Fits the design-token export; `textOn` in `apps/web/src/style.ts` already picks a readable ink. The pair-by-pair check stays in `design-token-export`.
- **Export only the selection to PNG**: a crop of the board without capturing all of it (`apps/web/src/png.ts`).
- ~~**Zoom to fit the board**~~ (done: key `1`, double click on the percentage): key `1` or double click on the zoom percentage. `fitView` already exists; it only needs exposing.
- **Shortcut cheat sheet** on `?`: shortcuts are only discoverable through tooltips today. Also listed in `community`.
- **Lock elements**: so a background does not move when dragging what is on top. Also listed in `image-tools`, but should apply to any element type.
- ~~**Paste a hex color to create a swatch**~~ (done), the same way pasting a URL creates a link (`paste` handler in `apps/web/src/App.tsx`, `normalizeHex` in `colors.ts`).
- **Final notice for an image batch**: replace "Adding N images…" with the result when the batch lands; it currently lingers a few seconds after the images are placed (`addImages` in `apps/web/src/image.ts`).

## Already shipped from this line

- Image colours join the palette (`06bdc10`).
- Design Tokens JSON export (`5ba6d49`).
- Swatches from image (`47dfb80`).
- Images added together land as a masonry (`9d21fe3`).
