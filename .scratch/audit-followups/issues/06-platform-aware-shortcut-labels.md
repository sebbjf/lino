# Show ⌘ instead of Ctrl on Mac

Status: ready-for-agent

Shortcuts are always labelled "Ctrl" (`Toolbar.tsx`, `ArrangeMenu.tsx`, `boardFile.ts`, `pages.tsx`) although the handlers accept `metaKey`; `aria-keyshortcuts="Control+Z"` is wrong on Mac. Add one `MOD` constant chosen by platform and use it for labels and `aria-keyshortcuts`. Do not show keyboard hints in touch-only notices.
