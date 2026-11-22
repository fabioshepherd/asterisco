import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

// The environment suite (e2e/environment: offline, it/en, colour scheme, reduced
// motion) belongs to the manual workflow (.github/workflows/manual-suite.yml),
// which sets E2E_AREA=environment; the default run, and so every PR, skips it.
const ENVIRONMENT_SUITE = process.env.E2E_AREA === "environment";

// E2E runs the production bundle (`vite preview`) in Chromium with the Tauri IPC
// mocked in-page (e2e/support/tauri-mock.ts). See docs/consolidation for scope.
export default defineConfig({
  testDir: ENVIRONMENT_SUITE ? "e2e/environment" : "e2e",
  testIgnore: ENVIRONMENT_SUITE ? [] : ["**/environment/**"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `bun run build && bun run preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
