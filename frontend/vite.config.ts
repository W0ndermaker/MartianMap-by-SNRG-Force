import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dataDir = fileURLToPath(new URL('../data', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@data': dataDir } },
  server: {
    // data/ lives next to frontend/, outside the Vite root.
    fs: { allow: ['.', dataDir] },
    // Same-origin /api in dev (also when the page is opened by LAN IP):
    // set VITE_API_URL to the dev-server origin to use it.
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        // Backend not running: answer 502 Bad Gateway (Vite's default is 500), so the app treats it
        // as an unreachable server and switches to offline data instead of showing a server error.
        configure: (proxy) => {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent) {
              response.writeHead(502, { 'Content-Type': 'text/plain' })
              response.end('Backend unreachable')
            }
          })
        },
      },
    },
  },
  // CesiumJS is one large chunk by design.
  build: { chunkSizeWarningLimit: 6000 },
})
