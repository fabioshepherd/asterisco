import { Crepe } from "@milkdown/crepe";
import { editorViewCtx } from "@milkdown/kit/core";
import type { EditorView } from "@milkdown/kit/prose/view";
import { beforeAll, describe, expect, it } from "vitest";

import { configureMarkdownFidelity } from "./markdown-fidelity";
import { taskListToggle } from "./task-list";

async function mountCrepe(defaultValue: string) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const crepe = new Crepe({ root, defaultValue, features: { [Crepe.Feature.ListItem]: false } });
  configureMarkdownFidelity(crepe);
  crepe.editor.use(taskListToggle);
  await crepe.create();
  const view = await new Promise<EditorView>((resolve) =>
    crepe.editor.action((ctx) => resolve(ctx.get(editorViewCtx))),
  );
  return { crepe, view };
}

/** The task item holding `text`, with its content laid out from x = 40. */
function taskItem(view: EditorView, text: string): HTMLLIElement {
  const li = [...view.dom.querySelectorAll<HTMLLIElement>('li[data-item-type="task"]')].find(
    (item) => item.textContent === text,
  );
  if (!li) throw new Error(`no task item ${text}`);
  const content = li.firstElementChild as HTMLElement;
  content.getBoundingClientRect = () => ({ left: 40 }) as DOMRect;
  return li;
}

function press(target: Element, clientX: number): MouseEvent {
  const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true, clientX });
  target.dispatchEvent(event);
  return event;
}

describe("task list toggle (Crepe's ListItem feature is off)", () => {
  // A press the plugin leaves alone reaches ProseMirror's own mouse handling,
  // which hit-tests the point; jsdom has no layout to hit-test.
  beforeAll(() => {
    if (!("elementFromPoint" in document)) {
      Object.defineProperty(document, "elementFromPoint", { value: () => null });
    }
  });

  it("renders task items as plain list items carrying their state", async () => {
    const { view } = await mountCrepe("- [ ] open\n- [x] done\n");
    expect(taskItem(view, "open").dataset.checked).toBe("false");
    expect(taskItem(view, "done").dataset.checked).toBe("true");
  });

  it("toggles an item when its checkbox gutter is pressed", async () => {
    const { crepe, view } = await mountCrepe("- [ ] open\n- [x] done\n");

    const event = press(taskItem(view, "open"), 10);
    press(taskItem(view, "done"), 10);

    expect(event.defaultPrevented).toBe(true);
    expect(crepe.getMarkdown()).toBe("- [x] open\n- [ ] done\n");
  });

  it("leaves a press on the item's text to the editor", async () => {
    const { crepe, view } = await mountCrepe("- [ ] open\n");
    const li = taskItem(view, "open");

    press(li, 60);
    press(li.firstElementChild!, 10);

    expect(crepe.getMarkdown()).toBe("- [ ] open\n");
  });

  it("does not toggle in a read-only (Reading view) editor", async () => {
    const { crepe, view } = await mountCrepe("- [ ] open\n");
    crepe.setReadonly(true);

    press(taskItem(view, "open"), 10);

    expect(crepe.getMarkdown()).toBe("- [ ] open\n");
  });

  it("ignores plain list items", async () => {
    const { crepe, view } = await mountCrepe("- plain\n");
    const li = view.dom.querySelector("li")!;
    (li.firstElementChild as HTMLElement).getBoundingClientRect = () => ({ left: 40 }) as DOMRect;

    press(li, 10);

    expect(crepe.getMarkdown()).toBe("- plain\n");
  });
});
