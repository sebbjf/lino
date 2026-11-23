# 1. Deploy on Vercel (web + API) with Neon Postgres

Date: 2026-11-15 · Status: accepted

## Context

The original plan proposed the API in Docker on Render with managed Postgres, and the web on Vercel or Netlify. The goal for v1 is a demo that is free, easy to deploy and always available.

Render's free web services sleep after about 15 minutes without traffic, and the first request afterwards takes 30 to 60 seconds. Render's free Postgres expires after about 30 days. Neither fits "always available".

## Decision

- Two Vercel projects from the same repository: `apps/web` (Vite, static) and `apps/api` (Fastify, detected with zero configuration from `src/server.ts`, runs as one Vercel Function).
- Postgres on Neon, added from the Vercel Storage tab so `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are injected into the API project.
- Migrations run at deploy (`vercel-build` → `src/migrate.ts`, on the direct URL); request handlers never migrate. Locally the server still migrates on start.
- The web calls the API cross-origin (`VITE_API_URL`), allowed by `CORS_ORIGIN`.

## Consequences

- No sleeping server: functions start in under a second; Neon wakes in about a second after idling.
- Vercel caps request bodies at 4.5 MB, so shared boards are limited to 4 MB (checked in the browser before uploading and again in the API).
- The per-IP rate limits live in memory, so each function instance keeps its own count. They slow down a casual abuser, not a determined one. Upgrade path: a shared store (Redis/Upstash) or Vercel's firewall rules.
- The Hobby plan is for personal, non-commercial use. A portfolio demo qualifies; a commercial launch would need Pro or another host.
- The `Dockerfile` stays, so moving the API to any container host only needs `DATABASE_URL` and a migration run.
- Vercel compiles the API with the project's TypeScript: `.ts` imports are rewritten to `.js` (`rewriteRelativeImportExtensions`), `typeRoots` is explicit so `@types/node` resolves in its build, the entry `src/server.ts` imports `fastify` itself (required by detection) and does not await `listen()` (the runtime stubs it and never calls back; `server.test.ts` mimics this) and the routes live in `routes.ts` because a file named `app.ts` would be picked as the entry instead. Reproduce the build locally with `pnpm dlx vercel build` and a `.vercel/project.json` (root `apps/api`, framework `fastify`).
