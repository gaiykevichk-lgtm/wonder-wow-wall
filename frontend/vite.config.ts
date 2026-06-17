/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react({
			// Force classic JSX runtime to avoid oxc/rolldown parse edge-cases
			// with React.FC generic arrow-function component bodies
			jsxRuntime: "automatic",
		}),
	],
	// Disable oxc transformer — use esbuild for JSX transpile instead
	// (oxc parser has a known edge-case with wrapped arrow-return components)
	oxc: false,
	cacheDir: "./node_modules/.vite-cache",
	// opencv.js is shipped as a static asset in `public/opencv.js` and loaded
	// via a `<script>` tag from `opencvLsdAdapter.ts` (not via ESM import).
	// Keeping the ~11 MB Emscripten UMD out of Vite's module graph entirely
	// avoids both the OOM-on-prebundle and the raw-served-UMD-timeout we
	// previously had to work around.
	optimizeDeps: {
		exclude: ["@techstark/opencv-js"],
	},
	server: {
		host: "0.0.0.0",
		port: 5176,
		hmr: {
			host: "5175-16615aee-c402-4f55-94a9-4dff1837aa41.preview.promto.ai",
			clientPort: 443,
			protocol: "wss",
		},
		proxy: {
			"/api": {
				target: "http://localhost:8081",
				changeOrigin: true,
			},
			"/uploads": {
				target: "http://localhost:8081",
				changeOrigin: true,
			},
		},
	},
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: "./src/test/setup.ts",
		css: false,
		include: ["src/**/*.test.{ts,tsx}"],
	},
});
