import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// @tauri-apps/cli sets these during `tauri dev`/`tauri build`.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/ — settings required for the Tauri 2 dev pipeline.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    // Tauri expects a fixed port; fail if it is taken.
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 5174 } : undefined,
    watch: {
      // Don't watch the Rust side from the frontend dev server.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Expose VITE_ and Tauri env vars to the client.
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  define: {
    // @milkdown/crepe bundles Vue; define its compile-time flags to silence the
    // dev warning and drop unused paths (we use neither Options API nor devtools).
    __VUE_OPTIONS_API__: "false",
    __VUE_PROD_DEVTOOLS__: "false",
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false",
  },
  build: {
    // macOS/Linux use a WebKit WebView; Windows (added in Phase 2) uses Chromium.
    // safari16 matches Tailwind v4's baseline and the modern WKWebView on supported macOS.
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari16",
    // Oxc is Vite 8's default minifier; esbuild minify is deprecated.
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
