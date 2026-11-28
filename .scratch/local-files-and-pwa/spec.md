# Your files are yours: local files and PWA

Status: done

Grilled 2026-11-28. Three slices, built in this order, one commit series each:

1. `issues/01-files-on-disk.md`: open and save a `.lino.json` directly on disk (File System Access API).
2. `issues/02-format-spec.md`: document the `.lino.json` format as an open spec.
3. `issues/03-offline-pwa.md`: installable, offline board app.

## Decisions

### Files on disk

- **Linked save target, not the source.** The browser copy (IndexedDB) stays the source of truth and keeps autosaving. A board can be linked to a file; **Save** writes it, **Save as…** picks a new file. No autosave to disk.
- **Chrome and Edge only.** Feature-detect `showOpenFilePicker` / `showSaveFilePicker`. Other browsers keep today's Export / Import, with no linked state and no dot. No polyfill.
- **The link survives reloads.** The `FileSystemFileHandle` is stored per board in IndexedDB. The first Save after a reload asks the browser for write permission.
- **Open** follows the import rule: replace the board if it is empty, otherwise open as a new board, and link the board to the file. A file already linked to a board (`isSameEntry`) switches to that board instead of duplicating it.
- **Menu and keys.** Chrome and Edge show **Open…**, **Save** (Ctrl+S) and **Save as…** (Ctrl+Shift+S). Other browsers keep the "Import board" / "Export board" labels. Ctrl+S always prevents the browser's own save dialog; without the API it exports.
- **Unsaved dot.** A linked board with changes not yet on disk shows a dot next to its name, in the title and in the boards menu. No "leave page?" prompt: the browser copy is safe.
- **External changes.** Before writing, compare the file's `lastModified` with the one Lino last read or wrote. If it changed, ask: overwrite, or Save as…
- **Rename and delete.** Renaming a board does not rename the file. Deleting a board forgets its handle. Lino never renames or deletes files on disk.
- **Images** stay inline in the file, as the portable snapshot already does (ADR 0002).

### Format spec

- Prose in `docs/file-format.md`, linked from the site's `/docs` page: the fields, the element kinds, inline images, `version`, and the compatibility rules. No JSON Schema yet. The format stays `version: 1`.

### Offline PWA

- `vite-plugin-pwa`. Precache the board app (`/board/`) only; the landing, docs and privacy pages stay online-only.
- Offline, the API features degrade with a notice: a link card keeps the bare URL, and sharing is unavailable.
- `autoUpdate`: a new version takes over silently on the next launch.
- `file_handlers` for `.lino.json`: double-clicking a board file opens it in installed Lino, already linked.
- Icons: 192 px, 512 px and a maskable icon, rendered from `favicon.svg` on the off-white board background (circles about 60% for the maskable one) and committed as PNGs.
