import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path('./src') } },
  // two pages: the landing at / and the board at /board/
  build: { rolldownOptions: { input: { landing: path('./index.html'), board: path('./board/index.html') } } },
})
