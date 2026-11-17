# Architecture review, 2026-11-16

Status: reference

Deepening candidates found by walking the hot spots of the last ~60 commits (store.ts, ElementView.tsx, boardFile.ts, storage.ts, Canvas.tsx, App.tsx). Vocabulary: module, interface, depth, seam, adapter, leverage, locality. Domain words in `GLOSSARY.md`. ADR-0001 (Vercel + Neon) is about deploy only and conflicts with none of these.

| # | Candidate | Strength | Spec | State |
| --- | --- | --- | --- | --- |
| 1 | Board snapshot has no home | Strong | [board-snapshot](../board-snapshot/spec.md) | **Done** (`9cd345a`) |
| 2 | Undo history leaks out of the store | Strong | [undo-history](../undo-history/spec.md) | **Done** (`bad8e0a`) |
| 3 | Selection commands exist twice | Worth exploring | [selection-commands](../selection-commands/spec.md) | **Done** (`1f123e2`..`4aea2a6`) |
| 4 | Element kind is spread across seven files | Worth exploring | [element-kinds](../element-kinds/spec.md) | needs-triage, not grilled |
| 5 | The move gesture is welded to the component | Speculative | [move-gesture](../move-gesture/spec.md) | needs-triage, not grilled |

## Order

Status 2026-11-17: 1, 2 and 3 are done (in the order 1, 3, 2, with `image-storage` in between). 4 and 5 wait for their triggers. Original reasoning: do 1 first: most duplicated knowledge (shape x4, link repair x3, open x3) and three real adapters already exist (file, share, IndexedDB). 2 is the cheapest win and makes 1's "open is one undo step" cleaner to test, so it can go first if a small change is wanted. 3 next. 4 and 5 only when a fifth element kind or a recurring drag bug shows up.
