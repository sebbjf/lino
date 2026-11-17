# Image storage that scales to large boards

Status: ready-for-agent

## Problem

Images are stored as data URLs inside one board record that is rewritten whole on every change (`apps/web/src/storage.ts`). With 100+ images, saving and rendering drag. PureRef handles hundreds of images; that is the bar.

## Idea

- Store each image as a separate blob in IndexedDB, referenced by id from the element.
- Keep thumbnails / downscaled levels and pick by zoom.
- Render only what is in or near the viewport.

## Notes

- Changes the saved format: needs a migration from data-URL boards and must keep `.lino.json` import/export and sharing (4 MB snapshot limit) working.
- Deleting a board or element must release its blobs.

## Decisions (2026-11-17, grilling)

Scope is blobs + migration + release only; thumbnails and viewport culling become their own specs after measuring. See `docs/adr/0002-images-in-a-local-blob-store.md`.

- Snapshot stays self-contained; only local storage uses ids. `images.ts` owns `externalize`/`inline`, the blob store and object-URL cache.
- Ids are SHA-256 of the stored bytes. Link card `image` fields use the same mechanism.
- Lazy per-board migration in one IndexedDB transaction (DB v2, `images` store).
- Release: one sweep at app start of blobs no saved board references (undo-safe).
- Keep the 1600px WebP as the only stored version.
- Tests: externalize/inline round-trip, migration (old record still loads), sweep.
- Commits: 1 `images.ts` + round-trip test, 2 DB v2 + migration, 3 readers resolve ids + export/share inline, 4 sweep.

Status: ready-for-agent.
