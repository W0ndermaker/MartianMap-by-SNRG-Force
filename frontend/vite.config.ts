import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev the backend runs on :8000; proxying /api avoids CORS, also when the page is opened by LAN IP.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  preview: {
    port: 4173,
    proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } },
  },
  build: { chunkSizeWarningLimit: 6000 },
});
