/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  cacheDir: '/tmp/vite-user-cache',
  // opencv.js is shipped as a static asset in `public/opencv.js` and loaded
  // via a `<script>` tag from `opencvLsdAdapter.ts` (not via ESM import).
  // Keeping the ~11 MB Emscripten UMD out of Vite's module graph entirely
  // avoids both the OOM-on-prebundle and the raw-served-UMD-timeout we
  // previously had to work around.
  optimizeDeps: {
    exclude: ['@techstark/opencv-js'],
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    hmr: {
      host: '3001-16615aee-c402-4f55-94a9-4dff1837aa41.preview.promto.ai',
      clientPort: 443,
      protocol: 'wss',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/uploads': {
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
