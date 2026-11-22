import { useEffect } from "react";

/**
 * Suppress the WebView's own right-click menu everywhere except in text.
 *
 * The app runs in a webview, so without this a right-click on the sidebar, the
 * tab strip or the editor chrome offers browser commands — Reload, Back, and on
 * some builds Inspect Element — which belong to a browser, not to a desktop
 * editor, and which sit on top of the app's own context menus.
 *
 * Text is the exception. In an `<input>`, a `<textarea>` or the editable
 * document, the OS menu carries cut/copy/paste plus the system spelling
 * suggestions and services, and the app has nothing better to put there. A
 * selection anywhere on the page counts too: right-clicking selected text to
 * copy it is the one browser habit worth keeping in reading mode.
 *
 * The app's own context menus (file tree, tab strip) are unaffected: they run on
 * React's handlers, which fire before this listener.
 */
export function useWebViewContextMenu(): void {
  useEffect(() => {
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target.closest('[contenteditable="true"]')
        ) {
          return;
        }
      }
      if (!window.getSelection()?.isCollapsed) return;
      event.preventDefault();
    };
    window.addEventListener("contextmenu", onContextMenu);
    return () => window.removeEventListener("contextmenu", onContextMenu);
  }, []);
}
