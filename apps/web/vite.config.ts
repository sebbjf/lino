import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))
const boardEntry = 'board/index.html'
const boardScope = '/board/'
// sRGB equivalent of the light --background in src/index.css.
const boardBackground = '#fafafa'

function boardPwa(): Plugin[] {
  const boardAssets = new Set([boardEntry, 'favicon.svg'])
  let workerPath: string
  return [
    ...VitePWA({
      scope: boardScope,
      registerType: 'autoUpdate',
      // Manual registration without the plugin's autoUpdate activation overrides.
      injectRegister: false,
      includeManifestIcons: false,
      manifest: {
        name: 'Lino',
        short_name: 'Lino',
        start_url: boardScope,
        display: 'standalone',
        background_color: boardBackground,
        theme_color: boardBackground,
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        file_handlers: [{ action: boardScope, accept: { 'application/json': ['.lino.json'] } }],
        // A file launch must start on the local board even if a shared board is open.
        launch_handler: { client_mode: 'navigate-new' },
      },
      workbox: {
        skipWaiting: false,
        clientsClaim: false,
        cleanupOutdatedCaches: true,
        globPatterns: [boardEntry, 'favicon.svg', 'assets/**/*'],
        navigateFallback: boardEntry,
        navigateFallbackAllowlist: [/^\/board\/(?:\?|$)/],
        manifestTransforms: [(entries) => ({
          manifest: entries.filter(({ url }) => boardAssets.has(url)),
          warnings: [],
        })],
      },
    }),
    {
      name: 'lino:board-pwa',
      apply: 'build',
      enforce: 'post',
      configResolved(config) {
        workerPath = resolve(config.root, config.build.outDir, 'sw.js')
      },
      transformIndexHtml: {
        order: 'post',
        handler(html, { path }) {
          return path === `/${boardEntry}` ? html : html.replace(/<link rel="manifest"[^>]*>/, '')
        },
      },
      generateBundle(_, bundle) {
        const board = Object.values(bundle).find((output) =>
          output.type === 'chunk' && output.facadeModuleId?.endsWith(`/${boardEntry}`))
        if (!board) this.error('Could not find the board entry for the offline cache.')

        // Follow the board graph so shared chunks work offline too.
        const pending = [board.fileName]
        for (const file of pending) {
          if (boardAssets.has(file)) continue
          boardAssets.add(file)
          const output = bundle[file]
          if (output?.type !== 'chunk') continue
          pending.push(...output.imports, ...output.dynamicImports)
          for (const css of output.viteMetadata?.importedCss ?? []) boardAssets.add(css)
          for (const asset of output.viteMetadata?.importedAssets ?? []) boardAssets.add(asset)
        }
      },
      closeBundle: {
        order: 'post',
        async handler(error) {
          if (error) return
          const worker = await readFile(workerPath, 'utf8')
          // Workbox adds a message-triggered activation path when skipWaiting is false.
          const messageHandler = /self\.addEventListener\("message",(\w+)=>\{\1\.data&&"SKIP_WAITING"===\1\.data\.type&&self\.skipWaiting\(\)\}\)[,;]/
          const updated = worker.replace(messageHandler, '')
          if (/\b(?:skipWaiting|clientsClaim)\s*\(/.test(updated)) {
            this.error('The board service worker must wait for open tabs to close before activating.')
          }
          if (updated !== worker) await writeFile(workerPath, updated)
        },
      },
    },
  ]
}

export default defineConfig({
  plugins: [react(), tailwindcss(), boardPwa()],
  // dev: the API runs on :3000; production sets VITE_API_URL
  server: { proxy: { '/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(/^\/api/, '') } } },
  resolve: { alias: { '@': path('./src') } },
  // the landing at /, the board at /board/, and small static pages
  build: {
    rolldownOptions: {
      input: {
        landing: path('./index.html'),
        board: path(`./${boardEntry}`),
        privacy: path('./privacy/index.html'),
        docs: path('./docs/index.html'),
        notFound: path('./404.html'),
      },
    },
  },
})
