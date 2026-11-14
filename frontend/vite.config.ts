import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dataDir = fileURLToPath(new URL('../data', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@data': dataDir } },
  // data/ lives next to frontend/, outside the Vite root.
  server: { fs: { allow: ['.', dataDir] } },
})
