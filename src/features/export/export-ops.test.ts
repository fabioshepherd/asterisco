import { beforeEach, describe, expect, it, vi } from "vitest";

// Event bus stand-in: `once` records handlers, `emit` records payloads.
const handlers = new Map<string, () => void>();
const calls: string[] = [];
vi.mock("@tauri-apps/api/event", () => ({
  once: vi.fn((event: string, handler: () => void) => {
    calls.push(`listen ${event}`);
    handlers.set(event, handler);
    return Promise.resolve(() => handlers.delete(event));
  }),
  emit: vi.fn((event: string) => {
    calls.push(`emit ${event}`);
    return Promise.resolve();
  }),
}));
let openDelay: Promise<void> = Promise.resolve();
vi.mock("@/lib/tauri/window", () => ({
  openPrintWindow: vi.fn(async (title: string) => {
    calls.push(`open ${title}`);
    await openDelay;
    return "print-7";
  }),
  closeWindowByLabel: vi.fn((label: string) => {
    calls.push(`close ${label}`);
    return Promise.resolve();
  }),
}));
vi.mock("./render-rich", () => ({
  renderRichContentHtml: vi.fn(() => Promise.resolve("<p>Hi</p>")),
  renderClipboardRichHtml: vi.fn(),
}));

import { useDocuments } from "@/stores/document";

import { printActiveDocument } from "./export-ops";

describe("printActiveDocument (SECURITY-05)", () => {
  beforeEach(() => {
    handlers.clear();
    calls.length = 0;
    openDelay = Promise.resolve();
    vi.useRealTimers();
    useDocuments.setState({ documents: [], activeId: null, tabs: [] });
    useDocuments.getState().createDocument({ path: "/w/notes.md", markdown: "Hi" });
  });

  it("opens the print window through Rust, after listening for it, and closes it when done", async () => {
    const printing = printActiveDocument();
    await vi.waitFor(() => expect(calls).toContain("open notes"));
    // Both listeners are in place before the window can announce itself.
    expect(calls.slice(0, 3)).toEqual(["listen print:ready", "listen print:done", "open notes"]);

    handlers.get("print:ready")?.();
    expect(calls).toContain("emit print:content");
    handlers.get("print:done")?.();
    await printing;
    expect(calls.at(-1)).toBe("close print-7");
  });

  it("on timeout stops listening, and closes a window that opens too late", async () => {
    vi.useFakeTimers();
    let windowOpens: () => void = () => {};
    openDelay = new Promise((resolve) => (windowOpens = resolve));

    const printing = printActiveDocument();
    await vi.waitFor(() => expect(calls).toContain("open notes"));
    await vi.advanceTimersByTimeAsync(10_000);
    await printing;

    // A stale "ready" listener would answer the next print's window.
    expect(handlers.size).toBe(0);
    windowOpens();
    await vi.waitFor(() => expect(calls).toContain("close print-7"));
  });
});
