# Idea backlog

Status: needs-triage

More feature ideas, noted on 2026-11-16. None is implemented and none repeats the other specs. They build on what Lino already has (link reader with colors and fonts, palette, Arrange layouts, token export), so most reuse existing code. Promote an idea to its own `.scratch/<slug>/spec.md` when it is picked up.

## Do first

1. **Sort by color**: the cheapest, and the best one to show in a demo.
2. **Back up all boards**: little code, and it removes the biggest fear of using an app with no account.
3. **Style tile**: more work, but no alternative has it and it closes the product's central idea.

## From moodboard to design system

- **Tone scale per color**: from a palette color, generate its 50-900 scale and export it in Tailwind and Tokens. Today only single colors are exported; a real design system needs scales.
- **Color roles**: mark colors as background, text, primary and accent, and export semantic tokens (`--color-primary`) next to the named ones.
- **Style tile preview**: a sample UI card (heading, paragraph, button) painted with the board's palette and fonts, to see how the design would look without leaving the moodboard.
- **Dark variant of the palette**: generate the dark version of the roles and export both.
- **Type pairing**: try heading and body combinations with the fonts found on links.

## Using the image colors now stored on each image

- **Sort by color**: one more Arrange layout that places images by hue (`layoutPositions` in `apps/web/src/geometry.ts`; `colors` on image elements). Images added before colors were stored need sampling first (`imageColors` in `image.ts`).
- **Find by color**: clicking a palette color highlights the images that contain it.
- **Eyedropper inside the board**: click a pixel of an image to take its color. The current eyedropper depends on the EyeDropper API, which only exists in Chromium; Firefox and Safari have none.
- **Drag a palette color** onto a note or the background to apply it.

## Trust in a local app with no account

- **Back up all boards** to one file, and restore it. With no account, clearing browser data loses everything.
- **Board trash**: recover a deleted board for a few days.
- **Named versions**: save snapshots of a board ("v1 client", "v2") and go back to them. Undo history is lost on reload.
- **Duplicate board**, and a **thumbnail** of each board in the boards menu.

## Capture and flow

- **Pasting an image URL** adds the image, not a link card.
- **Import an Are.na channel**: it has an open API and its audience is the audience of an open-source moodboard.
- **Explode a link**: turn a link card into swatches of its colors and specimens of its fonts on the board.
- **Command palette** (Ctrl+K) to reach any action without hunting in the toolbar.
- **Caption** attached to an image, moving with it.
- **Color-blindness simulation** of the board and the palette.

## Settings menu

There is no place for app-wide preferences today: everything is per board (`board`, `exportPrefs`) or implicit. One menu, opened from the top bar next to the boards menu, saved in its own IndexedDB record (not inside a board, so it never travels with a shared board or a `.lino.json`).

What it could hold, in the order it earns its place:

- **Appearance**: light, dark or system theme for the app chrome (the board keeps its own background).
- **Defaults for new boards**: background and pattern, messy mode on or off, export format and variable prefix.
- **Editing**: snap and alignment guides on or off, how many colors an image contributes to the palette (0 turns it off).
- **Motion**: reduce animations, on top of the system `prefers-reduced-motion`.
- **Language**, once there are translations (`community`).
- **Your data**: storage used, back up and restore all boards, delete everything. This is the natural home for "Back up all boards" above.
- **About**: version, shortcuts cheat sheet, links to docs, privacy and the repository.

Keep it small: a setting only goes in when there is a real choice behind it, never to avoid deciding a default.

## Notes

- Tone scales, roles, dark variant and type pairing overlap with `design-token-export`; do them there.
- Back up, trash and versions depend on how images are stored: check `image-storage` before designing the file.
- Pasting an image URL and the Are.na import fetch third-party content: go through the API's link reader and its SSRF guard, not a direct browser fetch.
