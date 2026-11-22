import { Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

/**
 * Toggle a GFM task item (`- [ ]` / `- [x]`) from its checkbox. Crepe's
 * ListItem feature, which drew the checkbox, is off (CODE-04), so the gfm
 * preset renders a task item as a plain `<li data-item-type="task"
 * data-checked>` and editor-theme.css draws the box in the marker gutter as a
 * pseudo-element. A press there targets the `<li>` itself, left of its content:
 * that press flips `checked`, as Crepe's checkbox did (pointer-only, and never
 * in a read-only Reading view). Presses on the item's text stay the editor's.
 */
function toggleTaskAt(view: EditorView, event: MouseEvent): boolean {
  if (!view.editable || event.button !== 0) return false;
  const li = event.target;
  if (!(li instanceof HTMLLIElement) || li.dataset.itemType !== "task") return false;
  // The gutter is left of the content: this hit test assumes a left-to-right
  // layout (the app ships `it` and `en` only).
  const content = li.firstElementChild;
  if (!content || event.clientX >= content.getBoundingClientRect().left) return false;

  const pos = view.posAtDOM(li, 0) - 1;
  const node = view.state.doc.nodeAt(pos);
  if (node?.type.name !== "list_item" || node.attrs.checked == null) return false;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, checked: !node.attrs.checked }),
  );
  event.preventDefault();
  return true;
}

export const taskListToggle = $prose(
  () => new Plugin({ props: { handleDOMEvents: { mousedown: toggleTaskAt } } }),
);
