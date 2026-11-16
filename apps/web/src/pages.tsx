import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Small static pages (privacy, docs, 404). The page picks its content from <div id="root" data-page="…">.

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="underline underline-offset-4 hover:text-foreground">
    {children}
  </a>
)
const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-12 mb-3 text-xl font-semibold tracking-tight text-foreground">{children}</h2>
const Code = ({ children }: { children: string }) => (
  <pre className="mt-3 overflow-x-auto rounded-2xl border border-border bg-card p-4 text-sm leading-6 text-foreground">
    <code>{children}</code>
  </pre>
)

function Shell({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <>
      <header className="px-4 pt-4 sm:px-8">
        <nav className="mx-auto flex max-w-3xl items-center justify-between rounded-full border border-border/60 bg-card/70 py-2 pr-2 pl-4 shadow-soft backdrop-blur">
          <a href="/" className="text-xl leading-none font-semibold tracking-tight">
            Lino
          </a>
          <a href="/board/" className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform active:scale-[0.97]">
            Open your board
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-16 pb-24 sm:px-8">
        <h1 className="text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.02] font-semibold tracking-[-0.045em] text-balance">{title}</h1>
        {lead && <p className="mt-4 text-lg text-muted-foreground">{lead}</p>}
        <div className="mt-8 space-y-4 leading-7 text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_p>code]:rounded [&_p>code]:bg-foreground/[0.06] [&_p>code]:px-1.5 [&_p>code]:py-0.5 [&_p>code]:text-[0.9em] [&_p>code]:text-foreground [&_li>code]:rounded [&_li>code]:bg-foreground/[0.06] [&_li>code]:px-1.5 [&_li>code]:py-0.5 [&_li>code]:text-[0.9em] [&_li>code]:text-foreground">
          {children}
        </div>
      </main>
      <footer className="border-t border-border px-4 py-6 text-xs text-muted-foreground sm:px-8">
        <div className="mx-auto flex max-w-3xl justify-between">
          <span>© {new Date().getFullYear()} Lino</span>
          <span className="flex gap-4">
            <A href="/docs/">Docs</A>
            <A href="/privacy/">Privacy</A>
          </span>
        </div>
      </footer>
    </>
  )
}

function Privacy() {
  return (
    <Shell title="Privacy" lead="Lino has no accounts, no cookies and no analytics. Here is what does leave your browser, and when.">
      <H2>Your boards stay on your device</H2>
      <p>
        Everything you pin is saved in your browser (IndexedDB) on this device. It is not sent to a server. Clearing your browser data deletes your boards, so use <strong>Export board</strong> if you want a backup.
      </p>

      <H2>What can leave your browser</H2>
      <ul>
        <li>
          <strong>Pasting a link.</strong> The address is sent to Lino's server, which fetches that public page to read its title, cover image, colors and fonts. The result goes back to your board; the server does not keep it.
        </li>
        <li>
          <strong>Sharing a board.</strong> Only when you press <em>Create link</em>. A fixed copy of the board, images included, is uploaded with no account or name attached. Anyone with the link can view it, and it is deleted after 90 days. It cannot be removed earlier, so do not share anything you want to keep private.
        </li>
        <li>
          <strong>Google Fonts.</strong> When a note uses a Google font, your browser asks Google for that font, as on any site that uses them.
        </li>
        <li>
          <strong>Rate limits and logs.</strong> To stop abuse, the server counts requests per IP address in memory. The hosting provider may keep standard server logs.
        </li>
      </ul>

      <H2>What Lino does not do</H2>
      <p>It sets no cookies, runs no trackers or ads, and does not collect your name, email or any profile.</p>

    </Shell>
  )
}

function Docs() {
  return (
    <Shell title="How to use Lino" lead="Pin references on a board, keep the colors you like, and copy a palette and fonts into your code.">
      <H2>1. Add references</H2>
      <p>
        Drop or paste <strong>images</strong>, paste a <strong>link</strong> (it becomes a card with the page's cover, colors and fonts), or add a <strong>note</strong> or a <strong>color</strong> from the toolbar. Drag to move, use the handles to resize and rotate, and <code>Ctrl+Z</code> undoes anything.
      </p>

      <H2>2. Build a palette</H2>
      <p>
        Open the palette panel to see the colors of your swatches, links and images, plus any you pick from an image with the eyedropper. Keep the ones you like and name them. Fonts found on linked pages are listed too; the list may be incomplete, because fonts come only from a page's CSS.
      </p>

      <H2>3. Export to code</H2>
      <p>
        Choose <strong>CSS variables</strong> or <strong>Tailwind</strong> in the palette panel and copy the result.
      </p>
      <Code>{`:root {
  --color-linen: #e4ddd1;
  --color-orange: #ef7d12;
  --font-newsreader: "Newsreader", serif;
}`}</Code>
      <p>
        As a Tailwind v4 theme it becomes an <code>@theme</code> block, which gives you classes such as <code>bg-orange</code> and <code>font-newsreader</code>:
      </p>
      <Code>{`@theme {
  --color-linen: #e4ddd1;
  --color-orange: #ef7d12;
  --font-newsreader: "Newsreader", serif;
}`}</Code>
      <ul>
        <li>
          <strong>Prefix</strong> (CSS only): <code>acme</code> writes <code>--acme-color-orange</code>. Tailwind always uses <code>--color-…</code> so its classes work.
        </li>
        <li>
          <strong>Hex or OKLCH:</strong> pick the color format you prefer.
        </li>
      </ul>

      <H2>4. Save, back up and share</H2>
      <ul>
        <li>
          <strong>Autosave:</strong> the board saves in your browser as you work. You can keep several boards.
        </li>
        <li>
          <strong>Export / import:</strong> a <code>.lino.json</code> file keeps everything and can be imported again. <strong>Download PNG</strong> gives an image of the whole board.
        </li>
        <li>
          <strong>Share:</strong> creates a read-only link to a copy of the board as it is now. It lasts 90 days. See <A href="/privacy/">Privacy</A>.
        </li>
      </ul>

      <H2>Keyboard</H2>
      <p>
        Every board action works from the keyboard: arrows move, <code>R</code> rotates, <code>Delete</code> removes, <code>Ctrl+D</code> duplicates. The full list is in the <A href="https://github.com/sebbjf/lino#board-shortcuts">README</A>.
      </p>
    </Shell>
  )
}

function NotFound() {
  return (
    <main
      className="grid min-h-svh place-items-center px-4 text-center"
      style={{ backgroundImage: 'radial-gradient(var(--dot) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
    >
      <div>
        <a href="/" aria-label="Lino home" className="inline-flex -space-x-1.5 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          {['bg-foreground/15', 'bg-foreground/35', 'bg-foreground/60', 'bg-foreground'].map((c) => (
            <span key={c} className={`size-4 rounded-full ring-2 ring-background ${c}`} />
          ))}
        </a>
        <p aria-hidden className="mt-10 text-[clamp(6rem,22vw,13rem)] leading-none font-semibold tracking-[-0.07em] text-foreground/15">
          404
        </p>
        <h1 className="-mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.05] font-semibold tracking-[-0.04em] text-balance">
          This page isn't on the board.
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-muted-foreground">The link may be broken, or the page may have moved.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-medium">
          <a href="/" className="rounded-full bg-foreground px-6 py-3 text-background shadow-soft transition-[translate,scale] outline-none hover:-translate-y-0.5 active:scale-[0.97] focus-visible:ring-[3px] focus-visible:ring-ring/50 motion-reduce:transition-none">
            Go home
          </a>
          <a href="/board/" className="rounded-full border border-border bg-card px-6 py-3 outline-none transition-[color,background-color,scale] active:scale-[0.97] hover:bg-foreground/[0.04] focus-visible:ring-[3px] focus-visible:ring-ring/50">
            Open your board
          </a>
        </div>
      </div>
    </main>
  )
}

const pages = { privacy: Privacy, docs: Docs, notfound: NotFound }
const root = document.getElementById('root')!
const Page = pages[root.dataset.page as keyof typeof pages] ?? NotFound
createRoot(root).render(
  <StrictMode>
    <Page />
  </StrictMode>,
)
