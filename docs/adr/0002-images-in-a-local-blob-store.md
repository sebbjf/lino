# 2. Images live in a local blob store; snapshots stay self-contained

Date: 2026-11-17 · Status: accepted

## Context

Every image is a WebP data URL (max 1600px) inside the one IndexedDB record of its board, rewritten whole on each change. Boards with 100+ images save and render slowly. The **Board snapshot** is also what board files and shared boards carry, so those need images inline (and the share API caps a board at 4 MB).

## Decision

- Local storage keeps images apart: a new `images` store (DB version 2), one blob per image, keyed by the SHA-256 of its bytes. Elements (images and link cards) hold the id.
- The portable snapshot is unchanged and self-contained. One module, `images.ts`, converts: `externalize` when saving, `inline` for board files and sharing.
- Migration is lazy, per board: opening a board that still has data URLs writes its blobs first and then the rewritten record, so a crash leaves the old record whole (the blobs are content-addressed, and orphans are swept). Unopened boards keep loading in the old format.
- Blobs are never released on delete. One sweep at app start deletes blobs no saved board references, so undo (in memory) can always restore a deleted image. It runs only when no other tab is open (a shared Web Lock per tab), because another tab may hold images not saved yet.
- Only the 1600px WebP is stored; no originals.

## Consequences

- Board files, sharing and the API do not change.
- Saving a board no longer rewrites image bytes; identical images are stored once across boards.
- An older Lino build cannot read a migrated board; there is no downgrade path.
- A deleted image's space is freed on the next launch, not at once.
- Exporting or sharing reads every blob back into a data URL; acceptable because both are rare.
- Thumbnails by zoom and viewport culling are separate, later specs.
