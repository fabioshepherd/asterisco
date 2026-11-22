import type { Ctx } from "@milkdown/kit/ctx";
import type { Selection } from "@milkdown/kit/prose/state";

import { useSelection } from "@/stores/selection";

/**
 * `listener.selectionUpdated` handler: report the selected text so the status
 * bar can show per-selection word/character counts. The listener runs inside
 * the plugin state's `apply`, before the view takes the new state, so the view
 * still holds the PREVIOUS selection: read the selection the listener passes.
 */
export function reportSelection(_ctx: Ctx, selection: Selection): void {
  if (selection.empty) useSelection.getState().clear();
  else
    useSelection
      .getState()
      .setText(selection.$from.doc.textBetween(selection.from, selection.to, " ", " "));
}
