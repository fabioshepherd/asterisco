import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Tauri boundary so the module logic is unit-testable in jsdom.
// (Hoisted so the mock factories below can reference these spies safely.)
const {
  readDir,
  readTextFile,
  writeTextFile,
  pathExists,
  ensureThemesDir,
  applyCustomThemeCss,
  notifyError,
} = vi.hoisted(() => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  pathExists: vi.fn(),
  ensureThemesDir: vi.fn(),
  applyCustomThemeCss: vi.fn(),
  notifyError: vi.fn(),
}));
vi.mock("@/lib/tauri/fs", () => ({ readDir, readTextFile, writeTextFile, pathExists }));
vi.mock("@/lib/tauri/themes", () => ({ ensureThemesDir }));
vi.mock("./apply-theme", () => ({ applyCustomThemeCss }));
vi.mock("@/stores/notifications", () => ({ notify: { error: notifyError } }));

import { useSettings } from "@/stores/settings";
import {
  affectsActiveTheme,
  listThemes,
  migrateLegacyCustomTheme,
  reapplyActiveTheme,
  selectTheme,
} from "./themes-folder";

beforeEach(() => {
  vi.clearAllMocks();
  ensureThemesDir.mockResolvedValue("/cfg/themes");
  useSettings.getState().setCustomThemeName(null);
});

describe("listThemes", () => {
  it("returns only .css files, sorted, by basename", async () => {
    const entries = [
      { name: "z.css", path: "/cfg/themes/z.css", isDir: false },
      { name: "a.css", path: "/cfg/themes/a.css", isDir: false },
      { name: "notes.txt", path: "/cfg/themes/notes.txt", isDir: false },
      { name: "sub", path: "/cfg/themes/sub", isDir: true },
    ];
    readDir.mockResolvedValue({ entries, total: entries.length, scanned: entries.length });
    expect(await listThemes()).toEqual(["a.css", "z.css"]);
  });
});

describe("selectTheme", () => {
  it("reads the file, applies it, and stores the name", async () => {
    readTextFile.mockResolvedValue(":root{--bg:#000}");
    await selectTheme("dark.css");
    expect(readTextFile).toHaveBeenCalledWith("/cfg/themes/dark.css");
    expect(applyCustomThemeCss).toHaveBeenCalledWith(":root{--bg:#000}");
    expect(useSettings.getState().customThemeName).toBe("dark.css");
  });

  it("clears when name is null", async () => {
    await selectTheme(null);
    expect(applyCustomThemeCss).toHaveBeenCalledWith(null);
    expect(useSettings.getState().customThemeName).toBeNull();
  });

  it("notifies and leaves state unchanged when the read fails", async () => {
    useSettings.getState().setCustomThemeName("prev.css");
    readTextFile.mockRejectedValue(new Error("boom"));
    await selectTheme("missing.css");
    expect(applyCustomThemeCss).not.toHaveBeenCalled();
    expect(useSettings.getState().customThemeName).toBe("prev.css");
    expect(notifyError).toHaveBeenCalledTimes(1);
  });
});

describe("reapplyActiveTheme", () => {
  it("re-reads and re-applies the active theme", async () => {
    useSettings.getState().setCustomThemeName("dark.css");
    readTextFile.mockResolvedValue(":root{--bg:#111}");
    await reapplyActiveTheme();
    expect(applyCustomThemeCss).toHaveBeenCalledWith(":root{--bg:#111}");
  });

  it("clears + notifies when the active theme file is gone", async () => {
    useSettings.getState().setCustomThemeName("dark.css");
    readTextFile.mockRejectedValue(new Error("not found"));
    await reapplyActiveTheme();
    expect(applyCustomThemeCss).toHaveBeenCalledWith(null);
    expect(useSettings.getState().customThemeName).toBeNull();
    expect(notifyError).toHaveBeenCalled();
  });
});

describe("migrateLegacyCustomTheme", () => {
  it("copies an outside file into the folder and selects it by name", async () => {
    pathExists.mockResolvedValue(false); // no collision
    readTextFile.mockResolvedValue("/* legacy */");
    await migrateLegacyCustomTheme("/somewhere/else/mytheme.css");
    expect(writeTextFile).toHaveBeenCalledWith("/cfg/themes/mytheme.css", "/* legacy */");
    expect(useSettings.getState().customThemeName).toBe("mytheme.css");
  });

  it("selects in place when the file already lives in the themes folder", async () => {
    readTextFile.mockResolvedValue("/* in folder */");
    await migrateLegacyCustomTheme("/cfg/themes/mytheme.css");
    expect(writeTextFile).not.toHaveBeenCalled();
    expect(useSettings.getState().customThemeName).toBe("mytheme.css");
  });

  it("appends a ' (1)' suffix when the base name collides", async () => {
    // Base name taken, first numbered candidate free.
    pathExists.mockImplementation((p: string) => Promise.resolve(p === "/cfg/themes/mytheme.css"));
    readTextFile.mockResolvedValue("/* legacy */");
    await migrateLegacyCustomTheme("/outside/mytheme.css");
    expect(writeTextFile).toHaveBeenCalledWith("/cfg/themes/mytheme (1).css", "/* legacy */");
    expect(useSettings.getState().customThemeName).toBe("mytheme (1).css");
  });
});

describe("affectsActiveTheme", () => {
  it("matches the active theme by basename and ignores others", () => {
    useSettings.getState().setCustomThemeName("dark.css");
    expect(affectsActiveTheme("/cfg/themes/dark.css")).toBe(true);
    expect(affectsActiveTheme("/cfg/themes/other.css")).toBe(false);
  });

  it("is always false when no theme is active", () => {
    useSettings.getState().setCustomThemeName(null);
    expect(affectsActiveTheme("/cfg/themes/dark.css")).toBe(false);
  });
});
