# Add a Content-Security-Policy to the web deploy

Status: ready-for-human

`apps/web/vercel.json` has the cheap headers but no CSP; it was left out because it can break production without a real-browser test. Starting point:

```
default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' data: <API origin>; frame-ancestors 'none'
```

`connect-src data:` is needed because `apps/web/src/link.ts` fetches data URLs. Test on a Vercel preview deploy before production: paste a link, paste an image, load Google Fonts from the Style menu, share and open a shared board, export PNG.
