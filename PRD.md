# PRD: Lino, a moodboard tool (from inspiration to design)

Draft v0.1 · Nov 14, 2026 · Provisional name: Lino

## 1. Summary

A web tool for developers and designers who want to gather inspiration (images, websites, notes and colors) on a board and turn it into a starting point for design: a palette and typefaces ready to paste into code. No account is needed: the board is edited and saved in the browser. The look of the tool itself is part of the product: calm and clean, inspired by mymind and built with shadcn-style components.

## 2. Problem and user

**Primary user:** developers and designers who use the tool for themselves (personal use), mostly when starting a web project.

**Problem:** current tools are good for collecting inspiration (Pinterest, Are.na, Milanote), but the step from "I have 30 references" to "I have a palette and fonts for my project" is done by hand.

**Hypothesis to validate:** if the board extracts and suggests a palette and typefaces, and exports them as CSS variables or a Tailwind theme, the user saves a real step and comes back to use it again.

## 3. v1 goals and non-goals

**Goals**

- A usable v1 in 4 weeks, deployed and stable.
- Zero entry friction: open the site and start, with no sign-up.
- Extract and export palette and typefaces reliably.
- A distinctive, recognizable visual identity (calm and clean, inspired by mymind).

**Out of v1**

- Identifying typefaces from images (a hard problem; fonts are only read from a URL's CSS).
- Mobile app (responsive web only).
- To be decided, proposed for phase 2: real-time collaboration, a browser extension and user accounts.

## 4. Product and aesthetic principles

- **Calm and clean:** near-white background, plenty of space and a clear hierarchy. Reference: mymind.
- **References provide the color:** the interface is neutral, and color comes mostly from the user's images and the palette swatches.
- **shadcn components with a custom theme:** serif headlines and a clean sans-serif interface, large radii, soft shadows and pill-shaped tags.
- **Subtle motion:** gentle fades, respecting `prefers-reduced-motion`.
- **Accessible:** sufficient contrast (watch out for pastels and light grays on a white background) and keyboard use for the main actions.

## 5. v1 features

### 5.1 Canvas

- Elements: image, text note, color swatch and link card.
- Drag, resize, rotate, reorder layers, duplicate and delete.
- Zoom and pan of the canvas.
- Undo and redo.

### 5.2 Adding content

- Upload, drag or paste images (with a size limit).
- Paste a URL: a card is created with the cover image and title.
- Text notes and loose colors (with a picker and hexadecimal code entry).

### 5.3 Extracting data from a URL

- Cover image and title (Open Graph).
- Typefaces used: reading `font-family` from the page's CSS. This is not always reliable, and the tool will say so.
- Dominant colors of the page, from the CSS and the cover image.
- If something fails, the card is still created with whatever was found and flags what is missing.

### 5.4 Board palette and typefaces

- A panel that gathers the board's colors (extracted and manual) and the fonts found.
- The user can remove, pin and rename colors before exporting.

### 5.5 Output

- Palette as CSS variables.
- Tailwind configuration (theme colors and font families).
- Image (PNG) or PDF of the board.
- Public read-only link (see 5.6).

### 5.6 Saving and sharing

- Automatic saving in the browser (IndexedDB), with no account.
- Sharing: when the user presses "Share", an anonymous copy of the board is uploaded and a unique read-only link is generated. It is a fixed copy: later changes do not update it.
- Shared boards have a size limit and a per-browser count limit.

## 6. Main flow

1. The user opens the site and lands on an empty board.
2. They drag in images, paste URLs and add notes or colors.
3. They review the palette and fonts panel and adjust.
4. They export CSS variables or a Tailwind theme, or download an image.
5. Optionally, they share a read-only link.

## 7. Non-functional requirements

- **Performance:** the canvas must stay smooth with about 100 elements. Images are downscaled and optimized on upload.
- **Reliability:** the demo must always be available. If URL extraction fails, the tool keeps working.
- **Security:** the service that reads URLs must block access to internal addresses (SSRF), with limits on time, response size and requests per user.
- **Privacy:** no accounts and no personal data. Local boards never leave the browser. Shared boards are anonymous and their expiry is to be decided.
- **Accessibility:** keyboard navigation for the main actions, sufficient contrast and reduced motion.

## 8. Architecture and proposed stack

Chosen stack: React with Vite on the frontend and a custom API in Node with Fastify. The backend is written by hand, instead of using a managed service, so that every decision can be explained in an interview.

- **Frontend:** React with Vite and TypeScript, Tailwind, shadcn/ui with a custom theme and Zustand for state. A custom history for undo and redo. The theme is designed with tweakcn. Extra components: Kibo UI used selectively (color picker, file upload zone, pill tags and image crop; check its maintenance before depending on it) and a few Smooth UI pieces for micro-interactions, avoiding adding GSAP. Kokonut UI is left out of v1.
- **Canvas:** elements in the DOM with CSS transforms, easier to style and to make accessible than a canvas element. To be revisited if performance falls short.
- **Local storage:** IndexedDB.
- **API:** Node with Fastify and TypeScript, with schema validation. Two main routes: read a URL and extract its data, and save and serve shared boards.
- **Database:** Postgres with Drizzle ORM and migrations.
- **Shared images:** S3-compatible storage (Cloudflare R2), with validated uploads and size limits.
- **Color extraction:** on the server, from the CSS and the cover image.
- **Deployment:** the API in Docker on Render with managed Postgres, and the frontend on Vercel or Netlify. Continuous integration with GitHub Actions (types and tests).

## 9. Risks

- **Extracting fonts from CSS can give poor results** (system fonts, fonts loaded by scripts, generic names). Mitigation: show what is found, filter out generic names and allow editing.
- **Reading third-party sites** poses security and abuse risks. Mitigation: SSRF protection, limits and caching.
- **Storage cost** of shared images. Mitigation: size and count limits, and expiry.
- **Image rights:** the user uploads their own content. There will be a usage notice and a way to take a link down.
- **The aesthetic can hurt performance** (gradients, blurs and heavy shadows). Mitigation: lightweight CSS effects and respect for the reduced-motion preference.

## 10. Milestones (4 weeks)

- **Week 1:** canvas with images, notes and colors; drag, resize, rotate, layers and local saving. In parallel, the API skeleton (Fastify, Postgres, Drizzle) and an empty deployment with continuous integration.
- **Week 2:** visual theme (shadcn/ui, typography and color), undo and redo, palette panel and color picker.
- **Week 3:** URL reading route with SSRF protection; pasting a URL on the board with cover, title, fonts and colors; export to CSS variables and to Tailwind.
- **Week 4:** sharing (upload to R2, boards in Postgres, read-only link), export to image, tests, accessibility, README and deployment.
- **Planned cut if time runs short:** PDF export moves to phase 2 and only the image is kept.

## 11. Success criteria

v1 is considered achieved when there is a **deployed, stable demo**:

- The main flow (section 6) works end to end.
- URL extraction does not break the tool when it fails.
- No console errors in the main flow and no data loss on reload.
- A public repository with a README that explains the problem, the decisions and the pending improvements.

## 12. Open questions

- Confirm the product name (provisional: Lino). Check which domains are available (lino.com, .app, .io, .dev) and whether to buy one, and check the GitHub and X usernames and the trademark register.
- Expiry and limit of shared boards.
- Whether real-time collaboration, the browser extension and accounts go into a phase 2.
- Repository license.
- What additional element types are needed (for example, links with a richer preview or freehand drawing).
