import { describe, expect, it } from "vitest";

import { MIN_MAIN_WIDTH, reflowLayout, SETTINGS_WIDTH } from "./use-reflow";

describe("reflowLayout", () => {
  it("docks both panels on a roomy window", () => {
    expect(reflowLayout(1280, 240, true)).toEqual({
      sidebarOverlay: false,
      settingsOverlay: false,
    });
  });

  it("floats both panels at 320 CSS px (640 px window at 200%)", () => {
    expect(reflowLayout(320, 240, true)).toEqual({ sidebarOverlay: true, settingsOverlay: true });
  });

  it("keeps the sidebar docked at 640 CSS px but floats Settings beside it", () => {
    expect(reflowLayout(640, 240, true)).toEqual({ sidebarOverlay: false, settingsOverlay: true });
  });

  it("docks Settings when the sidebar is hidden and the document keeps its column", () => {
    expect(reflowLayout(800, 240, false)).toEqual({
      sidebarOverlay: false,
      settingsOverlay: false,
    });
  });

  it("stays docked when the width is unknown", () => {
    expect(reflowLayout(null, 240, true)).toEqual({
      sidebarOverlay: false,
      settingsOverlay: false,
    });
  });
});

/*
 * The thresholds, for the default 240 px sidebar: the sidebar docks from
 * 240 + 400 = 640 px; Settings docks beside the docked sidebar from
 * 240 + 384 + 400 = 1024 px, and alone (sidebar hidden) from 384 + 400 = 784 px.
 */
describe("reflowLayout thresholds", () => {
  const SIDEBAR = 240;

  it("pins the constants the thresholds are built from", () => {
    expect(MIN_MAIN_WIDTH).toBe(400);
    expect(SETTINGS_WIDTH).toBe(384);
  });

  it("at 900 px docks the sidebar and floats Settings beside it", () => {
    // 900 - 240 = 660 px for the document; with Settings docked it would be 276.
    expect(reflowLayout(900, SIDEBAR, true)).toEqual({
      sidebarOverlay: false,
      settingsOverlay: true,
    });
  });

  it("at 1280 px docks both the sidebar and Settings", () => {
    // 1280 - 240 - 384 = 656 px left for the document.
    expect(reflowLayout(1280, SIDEBAR, true)).toEqual({
      sidebarOverlay: false,
      settingsOverlay: false,
    });
  });

  it("docks the sidebar from sidebar width + 400 px", () => {
    expect(reflowLayout(639, SIDEBAR, true).sidebarOverlay).toBe(true);
    expect(reflowLayout(640, SIDEBAR, true).sidebarOverlay).toBe(false);
    // A wider sidebar needs a wider window.
    expect(reflowLayout(879, 480, true).sidebarOverlay).toBe(true);
    expect(reflowLayout(880, 480, true).sidebarOverlay).toBe(false);
  });

  it("docks Settings beside the docked sidebar from 1024 px", () => {
    expect(reflowLayout(1023, SIDEBAR, true).settingsOverlay).toBe(true);
    expect(reflowLayout(1024, SIDEBAR, true).settingsOverlay).toBe(false);
  });

  it("docks Settings alone from 784 px when the sidebar is hidden or floating", () => {
    expect(reflowLayout(783, SIDEBAR, false).settingsOverlay).toBe(true);
    expect(reflowLayout(784, SIDEBAR, false).settingsOverlay).toBe(false);
    // A floating sidebar takes no column, so Settings still docks at 800 with a 480 sidebar.
    expect(reflowLayout(800, 480, true)).toEqual({ sidebarOverlay: true, settingsOverlay: false });
  });
});
