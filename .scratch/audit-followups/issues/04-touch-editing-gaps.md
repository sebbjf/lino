# Touch: multi-select, editing and target sizes

Status: needs-triage

What a phone still cannot do, or does awkwardly:

- **No multi-select**: only Shift+click and Shift+drag exist (`Canvas.tsx`, `ElementView.tsx`), so align, distribute and arrange are unreachable on touch. Needs a selection mode.
- **Editing depends on double tap**: re-editing a note or opening a link relies on `dblclick` firing with `touch-none`; unconfirmed on iOS. A visible "Edit" tool with one element selected would cover it.
- **Toolbar buttons are 32px**, under the 44px guideline. Raising them makes the toolbar 3-4 rows on a phone, so it needs a layout decision.
- Not verified on a real device: two-finger pinch that starts on an element (should now cancel the drag) and the larger hex pill and handles.
