# Performance on large boards

Status: needs-triage

Measured on 2026-11-16 by reading the render and save paths and running `pnpm build`. Nothing here is implemented. Ordered by impact; 1-3 are small and attack what makes a large board slow without waiting for `image-storage`.

## 1. Moving the view rewrites every image

`startAutosave` (`apps/web/src/storage.ts`) watches `view` among its keys, and `save()` writes the whole board as one record. Every pan or zoom rewrites all base64 images to IndexedDB 300 ms later: tens of MB per gesture on a 30-image board.

Fix: save the view in its own small record (for example `<boardId>:view`) and take it out of the board record's triggers. Compatible: when the new record is missing, read `view` from the old board record, so existing boards still open where they were.

## 2. Every pan frame re-renders every element

`Canvas.tsx` subscribes to `view` and renders `elements.map(...)`; `ElementView` is not wrapped in `memo` and there is no React Compiler. Wrapping `ElementView` in `memo` means panning touches no element (its props do not change; `zoom` only changes on zoom).

Check first that every prop passed is stable between renders (`el` objects are shared by the store when unchanged).

## 3. All images decode on open

The `<img>` elements have no `decoding="async"` or `loading="lazy"`. Adding them is trivial and smooths opening a large board. Confirm PNG export still gets fully loaded images.

## 4. Board bundle

`board` chunk is 92 kB gzip plus 69 kB shared (`src`), landing 54 kB. Reasonable. The cheap gain is lazy-loading what is not needed at start: PNG export (`png.ts`) and the style menu. Modest win.

## 5. Landing fonts

Newsreader ships about 550 kB of woff2 (normal and italic, three subsets each). Browsers only fetch the subsets they use, so not urgent; drop the italic if it is barely used.

## Related

- `image-storage`: the real fix for image-heavy boards (blobs, thumbnails, viewport culling). Items 1-3 are worth doing first because they are cheap and do not change the image format.

## Comments

2026-11-16: item 2 is already done: `ElementView` is wrapped in `memo` (`apps/web/src/ElementView.tsx`). Items 1 and 3 are still open.
