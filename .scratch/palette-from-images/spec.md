# Palette from images

Status: done <!-- backfill of stored colours and the per-image palette opt-out shipped 2026-11-19 -->

## Problem

Images only contribute colors through the eyedropper; `buildPalette` (`apps/web/src/colors.ts`) uses swatches, link colors and pinned colors. Automatic color extraction is the most expected moodboard feature.

## Idea

Extract the dominant colors of each image when it is added and feed them into the palette, the same way link colors are.

## Notes

- Do it in a canvas on the client; no server.
- Decide how many colors per image and how to avoid flooding the palette on image-heavy boards (dedupe near colors, cap, or opt-in per image).
- Update the docs text, which was corrected to say images do not contribute.

## Comments

2026-11-16: first version shipped. New images get their 3 main colours (`readImage` in `apps/web/src/image.ts`), stored on the element and read by `buildPalette`. Left open: images added before this have no colours (no backfill), and there is no per-image opt-out beyond hiding a colour in the palette.

2026-11-16: added "Swatches from image" in the toolbar: with one image selected it lays a row of up to 5 colour swatches under it (`imageColors` in `image.ts`, `swatchRow` in `store.ts`). Works on images added before colours were stored, since it samples the image again.

2026-11-19 grilled: finish it with (1) backfill: images without stored colours get sampled lazily after the board loads (not an undo step), and (2) per-image opt-out: `paletteOff?: boolean` on image elements, toggled in the style menu; `buildPalette` skips those images.
