# Let the owner revoke a shared board

Status: needs-triage

A shared copy is public for 90 days (plus up to 24 h of cache, `max-age=86400, immutable` in `apps/api/src/routes.ts`) and cannot be deleted. The Share popover now says so. Option: return a delete token from `POST /boards`, keep it locally with the board, and add `DELETE /boards/:id`.
