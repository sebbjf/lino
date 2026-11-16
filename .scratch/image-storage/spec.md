# Image storage that scales to large boards

Status: needs-triage

## Problem

Images are stored as data URLs inside one board record that is rewritten whole on every change (`apps/web/src/storage.ts`). With 100+ images, saving and rendering drag. PureRef handles hundreds of images; that is the bar.

## Idea

- Store each image as a separate blob in IndexedDB, referenced by id from the element.
- Keep thumbnails / downscaled levels and pick by zoom.
- Render only what is in or near the viewport.

## Notes

- Changes the saved format: needs a migration from data-URL boards and must keep `.lino.json` import/export and sharing (4 MB snapshot limit) working.
- Deleting a board or element must release its blobs.
