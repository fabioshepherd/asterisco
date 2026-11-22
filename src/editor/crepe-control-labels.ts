/**
 * Accessible names for Crepe's icon-only controls (WCAG 4.1.2).
 *
 * Crepe's block handle, table handles and link tooltip render icon-only
 * elements with no name, and their decorative SVGs surface as unnamed images.
 * None of those features takes a label in its config (the toolbar does, and is
 * labelled through `featureConfigs`), so the names are applied to the DOM after
 * Crepe renders it, and re-applied whenever Crepe adds or re-renders a control.
 *
 * The selectors follow Crepe's internal markup (`@milkdown/crepe` 7.23): pinned
 * by `crepe-control-labels.test.ts`; re-check them after a Milkdown upgrade.
 */

/** Localized names, one per control. */
export interface CrepeControlLabels {
  alignLeft: string;
  alignCenter: string;
  alignRight: string;
  deleteColumn: string;
  deleteRow: string;
  addRow: string;
  addColumn: string;
  linkInput: string;
  confirmLink: string;
  copyLink: string;
  editLink: string;
  removeLink: string;
}

/**
 * Pointer-only controls: the block handle's "+" and drag items are bare `div`s,
 * not focusable, with no keyboard or click handler (the "+" fires on
 * `pointerup` only). They are hidden from assistive tech rather than named as
 * buttons that do nothing; the slash menu is the keyboard route to the same
 * action.
 */
const HIDDEN = [".milkdown-block-handle"];

/**
 * `[selector, label, isButton]`. `isButton` marks a non-`<button>` element that
 * acts as one (a `div`/`span` with a click handler): it gets `role="button"`
 * so its name is allowed and announced.
 */
const CONTROLS: ReadonlyArray<readonly [string, keyof CrepeControlLabels, boolean]> = [
  ['[data-role="col-drag-handle"] .button-group > button:nth-of-type(1)', "alignLeft", false],
  ['[data-role="col-drag-handle"] .button-group > button:nth-of-type(2)', "alignCenter", false],
  ['[data-role="col-drag-handle"] .button-group > button:nth-of-type(3)', "alignRight", false],
  ['[data-role="col-drag-handle"] .button-group > button:nth-of-type(4)', "deleteColumn", false],
  ['[data-role="row-drag-handle"] .button-group > button', "deleteRow", false],
  ['[data-role="x-line-drag-handle"] .add-button', "addRow", false],
  ['[data-role="y-line-drag-handle"] .add-button', "addColumn", false],
  [".milkdown-link-edit .input-area", "linkInput", false],
  [".milkdown-link-edit .confirm", "confirmLink", true],
  [".milkdown-link-preview .link-icon", "copyLink", true],
  [".milkdown-link-preview .link-edit-button", "editLink", true],
  [".milkdown-link-preview .link-remove-button", "removeLink", true],
];

function setAttr(el: Element, name: string, value: string): void {
  // Only write on change: an unconditional write is a mutation of its own.
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

const ICON = ".milkdown-icon svg";

/** Every element `labelCrepeControls` touches, as one selector. */
const ANY_CONTROL = [...HIDDEN, ...CONTROLS.map(([selector]) => selector), ICON].join(",");

/** `root` itself when it matches, then its matching descendants. */
function within(root: ParentNode, selector: string): Element[] {
  const found = [...root.querySelectorAll(selector)];
  return root instanceof Element && root.matches(selector) ? [root, ...found] : found;
}

/** Name every known Crepe control in `root`; hide pointer-only handles and Crepe's decorative icons. */
export function labelCrepeControls(root: ParentNode, labels: CrepeControlLabels): void {
  for (const el of within(root, HIDDEN.join(","))) setAttr(el, "aria-hidden", "true");
  for (const [selector, key, isButton] of CONTROLS) {
    for (const el of within(root, selector)) {
      setAttr(el, "aria-label", labels[key]);
      if (isButton) setAttr(el, "role", "button");
    }
  }
  for (const svg of within(root, ICON)) setAttr(svg, "aria-hidden", "true");
}

/**
 * Keep Crepe's controls under `root` named as Crepe renders them. Returns a
 * disposer. Only added elements that are, or contain, a known control are
 * labelled, so typing (new text nodes, paragraphs, marks) costs no scan of the
 * whole editor.
 */
export function observeCrepeControls(root: HTMLElement, labels: CrepeControlLabels): () => void {
  labelCrepeControls(root, labels);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches(ANY_CONTROL) || node.querySelector(ANY_CONTROL)) {
          labelCrepeControls(node, labels);
        }
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
