# Self-hosting in one command

Status: needs-triage

`docker compose up` brings up web, API and Postgres, with a documented `.env`.

## Notes

- Fix the API Dockerfile first: it installs without a lockfile (`audit-followups/issues/07`).
- Document `TRUST_PROXY` and `MAX_STORE_BYTES` for self-hosters.
