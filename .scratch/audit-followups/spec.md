# Audit follow-ups

Work left over from the UX/UI and security/stability audits of 2026-11-16. The fixes that were applied landed in one commit ("fix: apply UX and security audit findings"); the tickets in `issues/` are what was deliberately not done, or done but not verified against real infrastructure.

## Progress (checked 2026-11-17, `main` b4508e0)

| # | Ticket | Done? | Evidence |
|---|--------|-------|----------|
| 01 | Verify API changes in deploy | No | Needs a real deploy; nothing recorded |
| 02 | Two tabs overwrite | No | `navigator.locks` exists only for the image sweep (`storage.ts`); `save()` is unguarded; no product decision |
| 03 | CSP | No | `vercel.json` has only nosniff, X-Frame-Options, Referrer-Policy |
| 04 | Touch gaps | No | No multi-select mode or Edit tool found |
| 05 | Revoke shared board | No | No `DELETE /boards/:id` in `routes.ts` |
| 06 | Platform-aware shortcuts | No | No `MOD` constant; labels still hard-coded "Ctrl" (`StyleMenu.tsx`, `Toolbar.tsx`) |
| 07 | Minor cleanups | No (0/8) | See checklist in the ticket |
