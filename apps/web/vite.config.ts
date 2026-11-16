import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // dev: the API runs on :3000; production sets VITE_API_URL
  server: { proxy: { '/api': { target: 'http://localhost:3000', rewrite: (p) => p.replace(/^\/api/, '') } } },
  resolve: { alias: { '@': path('./src') } },
  // the landing at /, the board at /board/, and small static pages
  build: {
    rolldownOptions: {
      input: {
        landing: path('./index.html'),
        board: path('./board/index.html'),
        privacy: path('./privacy/index.html'),
        docs: path('./docs/index.html'),
        notFound: path('./404.html'),
      },
    },
  },
})
