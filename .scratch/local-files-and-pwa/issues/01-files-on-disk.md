# 01: Open and save .lino.json files on disk

Status: done (native pickers not exercised by automation)

See `../spec.md`, section "Files on disk", for every decision.

Done when, in Chrome or Edge:

- Open… picks a `.lino.json`, opens it under the import rule, and links the board. Opening an already linked file switches to its board.
- Save writes the linked file (Save as… if the board has none); Save as… picks a new file and relinks the board.
- The link survives a reload: the first Save after a reload asks for permission, and later Saves don't.
- A dot shows while the board has changes not on disk, and clears on Save.
- Save asks overwrite / Save as… when the file changed on disk since Lino last read or wrote it.
- Deleting a board forgets its handle.

In other browsers, nothing changes except that Ctrl+S exports instead of opening the browser's save dialog.

The decisions (which action, whether the file changed, the dot state) live in pure functions with tests written first. `pnpm -r typecheck` and `pnpm -r test` pass.
