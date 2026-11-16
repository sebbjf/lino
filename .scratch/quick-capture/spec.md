# Quick capture

Status: needs-triage

Capture friction decides whether people stay.

- Browser extension or bookmarklet: "send to Lino" for the current image, selection or page.
- Import a whole folder of images.
- Paste or drop several images at once and lay them out without stacking.

## Notes

- With no account, the extension has to hand content to the open tab or the local store; decide the mechanism first.

## Comments

2026-11-16: several images added at once (drop, paste or file picker) now land as a masonry centred on the target, selected, as one undo step (`addImages` in `apps/web/src/image.ts`). Left open: extension/bookmarklet, folder import, and progress while a large batch is being read (nothing shows until all are decoded).
