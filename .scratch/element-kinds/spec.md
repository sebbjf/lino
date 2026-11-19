# Element kinds as a module

Status: done

Origin: architecture review, candidate 4 ([overview](../architecture-review/spec.md)). Not grilled yet: the decisions below are proposals. Payoff is conditional on planning a fifth kind (types have not changed in recent history).

## Problem

Everything that varies per element type (`image`, `note`, `color`, `link`) is a separate `if (el.type === ...)` chain: about 25 branches in 7 files.

| Place | image | note | color | link |
| --- | --- | --- | --- | --- |
| store.OWN / copyStyle | yes | yes | no | no |
| boardFile.toElement | yes | yes | yes | yes |
| ElementView render and open | yes | yes | yes | yes |
| png.ts draw | yes | yes | yes | yes |
| colors.ts palette | yes | no | yes | yes |
| StyleMenu / Toolbar | yes | yes | no | no |

Adding a fifth kind means editing all of them, and the compiler only catches the ones that use an exhaustive `switch`. `png.ts` re-implements how a note or link card looks, so CSS and canvas must agree by hand.

## Proposal

Start with the data side only: a per-kind module holding validation, the colours it contributes to the palette, its own style keys and its label. Rendering (React and canvas) stays outside; those are different adapters of one idea and forcing them under one interface would be a stretch.

## Benefits

- Locality: a new kind adds one module plus its two renderers.
- Tests: per-kind validation moves out of the 90-line `toElement` switch.

## Open questions for the grilling

- Is there a fifth kind actually planned? If not, defer.
- Overlaps with [board-snapshot](../board-snapshot/spec.md): `toElement` moves there first.

## Comments

2026-11-19 grilled: yes, a fifth kind is planned (`frame`, from frames-and-groups). Do the data side only, as proposed: one module per kind with validation, palette colours, own style keys and label; renderers (ElementView, png.ts) stay where they are.
