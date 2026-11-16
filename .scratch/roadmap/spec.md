# Roadmap: the best open-source moodboard app

Ideas from 2026-11-16, written after the UX and security audits. They come from reading the code and from general knowledge of the alternatives (PureRef, Milanote, Figma/FigJam, Are.na; open source: BeeRef, Excalidraw, tldraw), not from fresh market research. Some may partly exist already in code that was not read (`geometry.ts`, `png.ts`).

## Positioning

Do not compete as a general whiteboard: Excalidraw and tldraw already win there. The gap Lino can own is **the moodboard that ends in a design system**. It already reads colors and fonts from links and exports CSS/Tailwind; no open-source alternative does. Everything else should serve that idea, with no account and local-first.

## Specs, in recommended order

Each has its own `.scratch/<slug>/spec.md`.

| # | Spec | Group |
|---|---|---|
| 1 | `image-storage` | Foundations |
| 2 | `palette-from-images` | Foundations |
| 3 | `image-tools` | Foundations |
| 4 | `frames-and-groups` | Foundations |
| 5 | `quick-capture` | Foundations |
| 6 | `design-token-export` | Differentiators |
| 7 | `local-files-and-pwa` | Open source |
| 8 | `present-and-export` | Differentiators |
| 9 | `motion-media` | Differentiators |
| 10 | `templates-and-gallery` | Differentiators |
| 11 | `self-hosting` | Open source |
| 12 | `community` | Open source |
| 13 | `collaboration` | Open source, last |

Cheap work that does not need to wait for this order lives in `performance` (measured optimizations) and `quick-wins` (small features).

Touch and mobile gaps are tracked in `audit-followups/issues/04` and `06`.

`image-storage` is the only one with real technical risk: it changes the saved format and needs a migration. `collaboration` is the most expensive and should not start before 1-5 are solid.

## Non-goals

- **Required accounts**: "no account" is part of the appeal.
- **Arrows, connectors, diagrams**: that is a different app.
- **Built-in AI by default**: at most optional and bring-your-own-key (auto-tagging, naming palettes).
