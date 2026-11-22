import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWebViewContextMenu } from "./use-webview-context-menu";

/** Right-click `el` and report whether the WebView menu was suppressed. */
function rightClick(el: Element): boolean {
  const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}

beforeEach(() => {
  document.body.innerHTML = "";
  renderHook(() => useWebViewContextMenu());
});

afterEach(() => {
  window.getSelection()?.removeAllRanges();
});

describe("useWebViewContextMenu", () => {
  it("suppresses the browser menu on app chrome", () => {
    const sidebar = document.createElement("div");
    document.body.append(sidebar);

    expect(rightClick(sidebar)).toBe(true);
  });

  // In text the OS menu carries cut/copy/paste and the system spelling
  // suggestions, which the app has nothing better to replace.
  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
  ])("keeps the OS menu in an %s", (_name, make) => {
    const field = make();
    document.body.append(field);

    expect(rightClick(field)).toBe(false);
  });

  it("keeps the OS menu inside the editable document", () => {
    const doc = document.createElement("div");
    // jsdom does not reflect the property onto the attribute, and the attribute
    // is what the hook (and ProseMirror) actually use.
    doc.setAttribute("contenteditable", "true");
    const paragraph = document.createElement("p");
    doc.append(paragraph);
    document.body.append(doc);

    expect(rightClick(paragraph)).toBe(false);
  });

  // Right-clicking selected text to copy it is the one browser habit worth
  // keeping in reading mode, where nothing is editable.
  it("keeps the OS menu when there is a selection outside an editor", () => {
    const paragraph = document.createElement("p");
    paragraph.textContent = "some prose";
    document.body.append(paragraph);
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    window.getSelection()?.addRange(range);

    expect(rightClick(paragraph)).toBe(false);
  });
});
