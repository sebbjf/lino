# Palette from images

Status: needs-triage

## Problem

Images only contribute colors through the eyedropper; `buildPalette` (`apps/web/src/colors.ts`) uses swatches, link colors and pinned colors. Automatic color extraction is the most expected moodboard feature.

## Idea

Extract the dominant colors of each image when it is added and feed them into the palette, the same way link colors are.

## Notes

- Do it in a canvas on the client; no server.
- Decide how many colors per image and how to avoid flooding the palette on image-heavy boards (dedupe near colors, cap, or opt-in per image).
- Update the docs text, which was corrected to say images do not contribute.
