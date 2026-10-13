import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

/**
 * LogiSmart Desktop — configuration Vite pour Electron.
 * Le renderer est un SPA React, compilé vers dist/renderer.
 * Le main process est buildé par tsc vers dist/electron.
 */
export default defineConfig(({ command }) => {
  const isServe = command === 'serve';

  return {
    root: '.',
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    server: {
      port: 5174,
      strictPort: false,
      hmr: isServe,
    },
    build: {
      outDir: 'dist/renderer',
      rollupOptions: {
        input: {
          main: resolve(import.meta.dirname, 'src/main.tsx'),
        },
      },
      chunkSizeWarningLimit: 900,
    },
    define: {
      'process.env.NODE_ENV': isServe ? '"development"' : '"production"',
    },
  };
});
