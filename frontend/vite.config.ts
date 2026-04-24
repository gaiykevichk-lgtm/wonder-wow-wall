/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: process.env.VITE_CACHE_DIR || '/tmp/vite-cache',
  // opencv.js is an ~11 MB Emscripten UMD. Pre-bundling it at dev-server
  // startup is wasteful (and has OOM'd the 512 MB sandbox before); it is
  // only loaded on the auto-perspective code path via a dynamic `import()`.
  // Excluding it from `optimizeDeps` keeps the cold start fast and lets the
  // UMD evaluate only when actually needed.
  optimizeDeps: {
    exclude: ['@techstark/opencv-js'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    hmr: {
      host: '3000-16615aee-c402-4f55-94a9-4dff1837aa41.preview.promto.ai',
      clientPort: 443,
      protocol: 'wss',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
