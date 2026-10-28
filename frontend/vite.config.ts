/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	plugins: [
		tailwindcss(),
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
		port: 3000,
		// Backend origin is configurable so the dev server can proxy to whichever
		// FastAPI instance is running (local `start_dev.py` on 8081 by default).
		// Proxying keeps the browser same-origin: `API_BASE_URL` falls back to the
		// relative `/api`, so no CORS allow-list entry is needed for dev hosts.
		proxy: {
			"/api": {
				target: process.env.VITE_BACKEND_URL || "http://localhost:8081",
				changeOrigin: true,
			},
			"/uploads": {
				target: process.env.VITE_BACKEND_URL || "http://localhost:8081",
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
