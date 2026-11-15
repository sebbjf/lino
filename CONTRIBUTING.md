# Contributing to Lino

Thanks for wanting to help. This is a small project, so the process is light.

## Before you start

- Open an issue first for anything bigger than a small fix, so we can agree on the approach.
- Good first picks are in the [Roadmap](README.md#roadmap).
- Read [MAP.md](MAP.md) ("I want to change X, which file?"), [PRD.md](PRD.md) (what Lino is and isn't) and the [ADRs](docs/adr) (decisions already made).

## Setup

Needs Node 24 and pnpm.

```bash
pnpm install
pnpm dev        # web on :5173, api on :3000
```

Sharing boards needs Postgres; see [Quick start](README.md#quick-start). Everything else works without it.

## Making a change

1. Branch from `main`.
2. Keep the change focused: one concern per PR.
3. Add or update tests when you change logic (`vitest` in `apps/web`, `node --test` in `apps/api`).
4. Update [MAP.md](MAP.md) if you add, move or rename files.
5. Make sure this passes:

   ```bash
   pnpm typecheck && pnpm test && pnpm build
   ```

6. Open a PR describing what changed and why. Screenshots help for UI changes.

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat(web): …`, `fix(api): …`, `docs: …`).

## Project rules

- **No accounts.** The board lives in the browser; don't add sign-in or tracking.
- **Keyboard and screen readers.** Every board action needs a keyboard path, with labels and sufficient contrast (see [Accessibility](README.md#accessibility)). Respect `prefers-reduced-motion`.
- **User-supplied URLs are a security boundary.** Anything the server fetches or a shared board renders must stay validated (public addresses only, strict schemas). Don't loosen this without discussion.
- **Keep it simple.** Prefer the platform and existing dependencies over new ones.

## License

By contributing you agree that your work is released under the [MIT License](LICENSE).
