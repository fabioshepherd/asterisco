import { afterEach, describe, expect, it } from "vitest";

import { focusActiveEditor, returnFocus } from "./focus-return";

function mount(html: string): void {
  document.body.innerHTML = html;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("focusActiveEditor", () => {
  it("focuses the rich editor in Edit view", () => {
    mount(
      '<div id="document-panel" data-view="edit"><div class="ProseMirror" contenteditable="true"></div></div>',
    );
    focusActiveEditor();
    expect(document.activeElement).toBe(document.querySelector(".ProseMirror"));
  });

  it("focuses the source editor, not a code block of the hidden rich editor, in Source view", () => {
    mount(`<div id="document-panel" data-view="source">
      <div class="hidden"><div class="milkdown"><div class="cm-content" id="block" tabindex="-1"></div></div></div>
      <div class="cm-editor"><div class="cm-content" id="source" tabindex="-1"></div></div>
    </div>`);
    focusActiveEditor();
    expect(document.activeElement?.id).toBe("source");
  });

  it("focuses the panel itself in Reading view", () => {
    mount(
      '<div id="document-panel" data-view="reading" tabindex="0"><div class="ProseMirror" contenteditable="false"></div></div>',
    );
    focusActiveEditor();
    expect(document.activeElement?.id).toBe("document-panel");
  });
});

describe("returnFocus", () => {
  it("focuses the origin when focus is stranded on body", () => {
    mount('<button id="origin">o</button>');
    returnFocus(document.getElementById("origin"));
    expect(document.activeElement?.id).toBe("origin");
  });

  it("falls back to the active editor when the origin is gone", () => {
    mount(
      '<div id="document-panel" data-view="edit"><div class="ProseMirror" contenteditable="true"></div></div>',
    );
    const gone = document.createElement("button");
    returnFocus(gone);
    expect(document.activeElement).toBe(document.querySelector(".ProseMirror"));
  });

  it("moves focus out of the surface that is leaving", () => {
    mount('<button id="origin">o</button><div id="sheet"><button id="close">x</button></div>');
    document.getElementById("close")?.focus();
    returnFocus(document.getElementById("origin"), document.getElementById("sheet"));
    expect(document.activeElement?.id).toBe("origin");
  });

  it("does not steal focus that something else took on purpose", () => {
    mount('<button id="origin">o</button><button id="tree">t</button>');
    document.getElementById("tree")?.focus();
    returnFocus(document.getElementById("origin"));
    expect(document.activeElement?.id).toBe("tree");
  });
});
