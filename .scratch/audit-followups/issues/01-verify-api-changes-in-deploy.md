# Verify the API changes against the real deploy

Status: ready-for-human

Three changes passed tests and typecheck but were never run against real infrastructure:

- **Client IP for rate limiting** (`apps/api/src/server.ts`): `TRUST_PROXY=1` now trusts a single proxy hop. Check what `req.ip` is on Vercel (and Render, if used). If two proxies sit in front, every user shares one rate-limit bucket; if `TRUST_PROXY` is unset on Vercel, the same happens.
- **Global storage cap** (`apps/api/src/boards.ts`): `create` sums `boards.bytes` and throws `StoreFullError` (503) above `MAX_STORE_BYTES` (default 400 MB). Only typechecked, never run against Postgres. Confirm the default fits the Neon plan.
- **Security headers** (`apps/web/vercel.json`): `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`. Confirm with `curl -I` after deploy that they are served and nothing breaks.
