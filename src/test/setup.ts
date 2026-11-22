import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// jsdom does not implement layout, so Range#getClientRects is missing. Some
// ProseMirror plugins (e.g. prosemirror-virtual-cursor) call it from a deferred
// selection handler after the editor dispatches a selection change, which would
// otherwise surface as an uncaught async exception during tests. Provide empty
// rect stubs so those layout reads no-op instead of throwing.
if (typeof Range !== "undefined") {
  const emptyRectList = { length: 0, item: () => null, [Symbol.iterator]: function* () {} };
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => emptyRectList as unknown as DOMRectList;
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  }
}

// jsdom does not implement Element#scrollIntoView; the outline calls it to keep
// the active heading in view as the editor scrolls. Provide a no-op so tests
// that mount the outline don't throw.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Same gap for Element#scrollTo, which the settings panel calls to return a
// freshly switched tab to the top of its scroller.
if (typeof Element !== "undefined" && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}

// jsdom does not implement matchMedia; provide a minimal stub for theme logic.
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// jsdom does not implement IntersectionObserver; Milkdown's code-block NodeView
// (CodeMirror) constructs a shared observer when a fenced block renders. Provide
// an inert stub so tests that mount documents containing code blocks don't throw.
if (!("IntersectionObserver" in globalThis)) {
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "";
    readonly thresholds: readonly number[] = [];
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }
  globalThis.IntersectionObserver =
    IntersectionObserverStub as unknown as typeof IntersectionObserver;
}

// jsdom does not implement ResizeObserver; the tab strip observes itself to
// recompute its overflow fades. Provide an inert stub so components that mount
// it don't throw.
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}

// jsdom does not implement Blob#arrayBuffer; some code paths (e.g. image upload
// reading dropped/pasted File bytes) need it. Back it with FileReader, which
// jsdom does implement, so tests can construct a real File and read its bytes.
if (typeof Blob !== "undefined" && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function arrayBuffer(): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
      reader.readAsArrayBuffer(this);
    });
  };
}
