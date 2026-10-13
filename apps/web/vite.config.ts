import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { fileURLToPath, URL } from 'node:url';

/**
 * En dev, Vite sert le front sur 5173 et proxye /api vers l'API (4000) :
 * même origine → cookies httpOnly fonctionnent sans configuration CORS.
 * En production, `VITE_API_URL` pointe vers l'API déployée.
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': { target: process.env.VITE_PROXY_API ?? 'http://localhost:4000', changeOrigin: false },
      '/uploads': { target: process.env.VITE_PROXY_API ?? 'http://localhost:4000', changeOrigin: false },
      '/socket.io': {
        target: process.env.VITE_PROXY_API ?? 'http://localhost:4000',
        ws: true,
        changeOrigin: false,
      },
    },
  },
  preview: { port: 4173 },
  build: {
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
