import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { beforeEach, describe, expect, it } from "vitest";

import { useSelection } from "@/stores/selection";

import { reportSelection } from "./selection-report";

async function mountCrepe(defaultValue: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue });
  crepe.on((listener) => listener.selectionUpdated(reportSelection));
  await crepe.create();
  return new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
}

describe("reportSelection", () => {
  beforeEach(() => useSelection.getState().clear());

  it("reports the new selection on the same step, not the previous one", async () => {
    const view = await mountCrepe("hello world\n");
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    expect(useSelection.getState().text).toBe("hello");

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 7, 12)));
    expect(useSelection.getState().text).toBe("world");
  });

  it("clears the count when the selection collapses", async () => {
    const view = await mountCrepe("hello world\n");
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 3)));
    expect(useSelection.getState().text).toBe("");
  });
});
