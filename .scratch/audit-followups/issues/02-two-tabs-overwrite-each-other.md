# Two tabs overwrite each other's boards

Status: needs-triage

`save()` in `apps/web/src/data/storage.ts` writes the whole `elements` array and the whole `index` from memory, so the last tab to save wins:

- Same board in two tabs: edits made in tab A vanish when tab B autosaves.
- Tab B open on `/board/` while tab A does "Save to my boards" or "New board": B's next autosave rewrites `index` with its stale list and the new board is orphaned (data in IndexedDB, no index entry).

Not fixed because the small fix (Web Locks, single writer) leaves the second tab editable but not saving, which needs a product decision: a visible "open in another tab" read-only mode, or merging/reloading on change (`BroadcastChannel`).
