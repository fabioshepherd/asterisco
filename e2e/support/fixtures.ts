import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

import { installTauriMock, type MockSeed, type MockState } from "./tauri-mock";

/** Workspace folder the mock serves; every fixture lives directly under it. */
export const WORKSPACE = "/work";

const FIXTURES = path.join(import.meta.dirname, "..", "fixtures");

/** A fixture file from `e2e/fixtures`, read as the exact bytes the mock serves. */
export function fixture(name: string): string {
  return readFileSync(path.join(FIXTURES, name), "utf8");
}

export function workspacePath(name: string): string {
  return `${WORKSPACE}/${name}`;
}

interface LaunchOptions {
  /** Fixture names to open at startup, as if passed by the OS ("open with"). */
  open?: string[];
  saveDialog?: (string | null)[];
  language?: "en" | "it";
  /** Extra workspace files (path relative to the workspace -> contents). */
  files?: Record<string, string>;
}

export interface App {
  page: Page;
  /** Seed the mock, load the app, and wait until the first document is open. */
  launch: (options?: LaunchOptions) => Promise<void>;
  /** The in-page mock state (files written, unmocked commands). */
  mock: () => Promise<MockState>;
}

export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    const app: App = {
      page,
      launch: async ({ open = [], saveDialog = [], language = "en", files = {} } = {}) => {
        const names = readdirSync(FIXTURES).filter((name) => name.endsWith(".md"));
        const seed: MockSeed = {
          files: {
            ...Object.fromEntries(names.map((name) => [workspacePath(name), fixture(name)])),
            ...Object.fromEntries(
              Object.entries(files).map(([name, contents]) => [workspacePath(name), contents]),
            ),
          },
          store: { hasSeenWelcome: true, language, workspaceRoot: WORKSPACE },
          pendingFiles: open.map(workspacePath),
          saveDialog,
          locale: language,
        };
        await page.addInitScript(installTauriMock, seed);
        await page.goto("/");
        if (open.length > 0) {
          await expect(page.getByRole("tabpanel")).toBeVisible();
          await expect(page.locator(".ProseMirror").first()).toBeVisible();
        }
      },
      mock: () =>
        page.evaluate(() => (window as unknown as { __tauriMock: MockState }).__tauriMock),
    };

    await use(app);

    // Every IPC call the flows make must be mocked, and nothing may throw.
    const { unmocked } = await app.mock();
    expect(unmocked, "unmocked Tauri commands").toEqual([]);
    expect(errors, "uncaught page errors").toEqual([]);
  },
});

export { expect };
