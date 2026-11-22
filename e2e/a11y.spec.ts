import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./support/fixtures";

/*
 * Keyboard walkthrough (WCAG 2.2 AA), dependency-free: roles and names come from
 * `getByRole`, focus from `toBeFocused` and `:focus-visible`, and the focus ring
 * from computed styles. Each test names the Wave 2 finding it guards
 * (docs/consolidation/w2-a11y-findings.md).
 */

interface FocusState {
  focused: boolean;
  focusVisible: boolean;
  /** A 2px+ outline or a box-shadow drawn in the `--ring` colour. */
  ring: boolean;
}

/**
 * Where the focus indicator of `el` is drawn, in the page: on the element; on a
 * direct child (a tree row is the `treeitem`'s first child, the sidebar splitter
 * draws a bar because the strip is 6px wide); or on a `:focus-within` ancestor
 * (a search field's input row).
 */
function focusState(el: Element): FocusState {
  const probe = document.createElement("span");
  probe.style.color = "var(--ring)";
  document.body.append(probe);
  const ring = getComputedStyle(probe).color;
  probe.remove();

  const outlined = (node: Element) => {
    const style = getComputedStyle(node);
    return (
      style.outlineStyle !== "none" &&
      parseFloat(style.outlineWidth) >= 2 &&
      style.outlineColor === ring
    );
  };
  const shadowed = (node: Element) => getComputedStyle(node).boxShadow.includes(ring);
  const bar = (node: Element) => {
    const box = node.getBoundingClientRect();
    return getComputedStyle(node).backgroundColor === ring && Math.min(box.width, box.height) >= 2;
  };
  const drawn = (node: Element) => outlined(node) || shadowed(node);

  const onChild = [...el.children].some(
    (child) => drawn(child) || (el.getAttribute("role") === "separator" && bar(child)),
  );
  const parent = el.parentElement;
  const onAncestor = [parent, parent?.parentElement].some(
    (node) => node?.matches(":focus-within") && drawn(node),
  );
  return {
    focused: el === document.activeElement,
    focusVisible: el.matches(":focus-visible"),
    ring: drawn(el) || onChild || onAncestor,
  };
}

/**
 * `locator` has keyboard focus and shows it: it matches `:focus-visible` and a
 * ring is painted. Polled: colours transition in (instantly under reduced
 * motion, but still on the next frame).
 */
async function expectFocusVisible(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused();
  await expect
    .poll(() => locator.evaluate(focusState))
    .toEqual({ focused: true, focusVisible: true, ring: true });
}

/** The active option of a combobox (focus stays in the input) draws the ring (A11Y-04). */
async function expectActiveOptionRing(combobox: Locator): Promise<void> {
  const id = await combobox.getAttribute("aria-activedescendant");
  expect(id, "aria-activedescendant").toBeTruthy();
  const option = combobox.page().locator(`[id="${id}"]`);
  await expect.poll(async () => (await option.evaluate(focusState)).ring).toBe(true);
}

/** The editor's focus indicator is its caret, painted in ink, not in the border grey (A11Y-05). */
async function expectInkCaret(editor: Locator): Promise<void> {
  await expect(editor).toBeFocused();
  await expect
    .poll(() =>
      editor.evaluate((el) => {
        const resolve = (value: string) => {
          const probe = document.createElement("span");
          probe.style.color = value;
          el.append(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        };
        const caret = getComputedStyle(el).getPropertyValue("--prosemirror-virtual-cursor-color");
        return caret.trim() !== "" && resolve(caret) === resolve("var(--fg)");
      }),
    )
    .toBe(true);
}

/** The active document's editing surface (Edit view). */
function editorOf(page: Page): Locator {
  return page.getByRole("tabpanel").locator('.ProseMirror[contenteditable="true"]');
}

async function runCommand(page: Page, name: string): Promise<void> {
  await page.keyboard.press("ControlOrMeta+Shift+P");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette.getByRole("combobox")).toBeFocused();
  await page.keyboard.type(name);
  // The option's name is the label, then its shortcut hint when it has one.
  await expect(palette.getByRole("option", { name: new RegExp(`^${name}( |$)`) })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(palette).toBeHidden();
}

test("landmarks, roles and names (A11Y-06, A11Y-07, A11Y-09)", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md"] });

  await expect(page.getByRole("menubar")).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "File tree" });
  await expect(sidebar.getByRole("tree", { name: "File tree" })).toBeVisible();
  const tablist = page.getByRole("tablist", { name: "Open documents" });
  await expect(tablist.getByRole("tab", { name: "roundtrip.md" })).toHaveAttribute(
    "aria-keyshortcuts",
    "Delete",
  );
  // "New tab" sits after the tablist, which owns only tabs.
  await expect(tablist.getByRole("button", { name: "New tab" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "New tab" })).toBeVisible();
  const panel = page.getByRole("tabpanel", { name: "roundtrip.md" });
  await expect(panel.getByRole("textbox", { name: "roundtrip.md", exact: true })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "Document view" })).toBeVisible();

  // Every button in the document is named, block handles and table and code
  // block controls included; their icons stay out of the tree.
  await panel.getByRole("heading", { name: "Round trip" }).hover();
  await expect(panel.locator(".milkdown-block-handle")).toHaveAttribute("aria-hidden", "true");
  const tree = await panel.ariaSnapshot();
  expect(tree, "unnamed button in the document").not.toMatch(/- button(?: \[[^\]]*\])?:?$/m);
  await expect(panel.locator(".milkdown-icon svg:not([aria-hidden='true'])")).toHaveCount(0);
  // Nor is any image unnamed: a Mermaid diagram is named too (WCAG 1.1.1).
  expect(tree, "unnamed image in the document").not.toMatch(/- img(?: \[[^\]]*\])?:?$/m);
  await expect(panel.getByRole("img", { name: "Diagram", exact: true })).toBeVisible();
});

test("a Mermaid diagram with accTitle is named by it (WCAG 1.1.1)", async ({ app }) => {
  const { page } = app;
  await app.launch({
    open: ["titled.md"],
    files: {
      "titled.md":
        "```mermaid\ngraph TD\n  accTitle: Release pipeline\n  accDescr: Build then ship\n  A --> B\n```\n",
    },
  });
  const panel = page.getByRole("tabpanel", { name: "titled.md" });
  const diagram = panel.locator(".mermaid-preview");
  await expect(diagram).toBeVisible();
  await expect(diagram).toHaveAccessibleName("Release pipeline");
  await expect(diagram).toHaveAttribute("aria-description", "Build then ship");
});

test("Tab walks the chrome once, with a visible ring at every stop, and leaves the editor (A11Y-01, A11Y-05, A11Y-08, A11Y-09, A11Y-14)", async ({
  app,
}) => {
  const { page } = app;
  // Two tabs: the strip is still one stop, and no close button is one.
  await app.launch({ open: ["roundtrip.md", "notes.md"] });
  const sidebar = page.getByRole("complementary", { name: "File tree" });
  const editor = page.getByRole("tabpanel").getByRole("textbox", { name: "notes.md", exact: true });
  const tab = async (target: Locator) => {
    await page.keyboard.press("Tab");
    await expectFocusVisible(target);
  };

  await tab(page.getByRole("menubar").getByRole("menuitem").first());
  await tab(page.getByRole("button", { name: "Minimize" }));
  await tab(page.getByRole("button", { name: "Maximize" }));
  await tab(page.getByRole("button", { name: "Close", exact: true }));
  await tab(sidebar.getByRole("button", { name: "Toggle sidebar" }));
  await tab(sidebar.getByRole("button", { name: "New file" }));
  await tab(sidebar.getByRole("button", { name: "Open folder" }));
  await tab(sidebar.getByRole("textbox", { name: "Filter documents" }));
  // The tree is one stop, on its first row.
  await tab(sidebar.getByRole("treeitem", { name: "deflist.md" }));
  await tab(sidebar.getByRole("button", { name: "Outline" }));
  await tab(sidebar.getByRole("navigation", { name: "Document outline" }).getByRole("button"));
  await tab(sidebar.getByRole("separator", { name: "Resize sidebar" }));
  await tab(page.getByRole("tab", { name: "notes.md" }));
  await tab(page.getByRole("button", { name: "New tab" }));

  await page.keyboard.press("Tab");
  await expectInkCaret(editor);

  // Tab leaves the editor without typing into it.
  await tab(page.getByRole("radio", { name: "Edit" }));
  await expect(editor.getByRole("heading", { level: 1 })).toHaveText("Notes");
  await expect(editor.locator("p").first()).toHaveText("The first line of the notes.");
  await tab(page.getByRole("button", { name: "Auto-save" }));
});

test("file tree: arrows, Home/End, Enter, one ring, context menu (A11Y-08)", async ({ app }) => {
  const { page } = app;
  await app.launch({
    open: ["notes.md"],
    files: { "docs/adr.md": "# ADR\n", "docs/spec.md": "# Spec\n" },
  });
  const tree = page.getByRole("tree", { name: "File tree" });
  const item = (name: string) => tree.getByRole("treeitem", { name, exact: true });

  await runCommand(page, "Focus File Tree");
  await expect(item("docs")).toBeFocused();
  await page.keyboard.press("End");
  await expect(item("unsafe.md")).toBeFocused();
  await page.keyboard.press("Home");
  await expect(item("docs")).toBeFocused();

  // Expanded, the folder's rows render inside its treeitem: only its own row is ringed.
  await page.keyboard.press("ArrowRight");
  await expect(item("docs")).toHaveAttribute("aria-expanded", "true");
  await expect(item("adr.md")).toBeVisible();
  await expectFocusVisible(item("docs"));
  const ringed = () =>
    tree.evaluate((el) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--ring)";
      document.body.append(probe);
      const ring = getComputedStyle(probe).color;
      probe.remove();
      return [...el.querySelectorAll("*")].filter((node) => {
        const style = getComputedStyle(node);
        return style.outlineStyle !== "none" && style.outlineColor === ring;
      }).length;
    });
  await expect.poll(ringed).toBe(1);

  await page.keyboard.press("ArrowDown");
  await expectFocusVisible(item("adr.md"));
  await page.keyboard.press("ArrowUp");
  await expect(item("docs")).toBeFocused();

  await page.keyboard.press("End");
  await page.keyboard.press("ArrowUp");
  await expect(item("roundtrip.md")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "roundtrip.md" })).toHaveAttribute(
    "aria-selected",
    "true",
  );

  await item("images.md").focus();
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: "File actions" });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(item("images.md")).toBeFocused();
});

test("tabs: arrows rove, Enter selects, Delete on unsaved asks, Escape returns (A11Y-09, A11Y-18)", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md", "notes.md"] });
  const notes = page.getByRole("tab", { name: /^notes\.md/ });
  const roundtrip = page.getByRole("tab", { name: /^roundtrip\.md/ });

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.type("!");
  await expect(page.getByRole("tab", { name: "notes.md, unsaved changes" })).toBeVisible();

  // Shift+Tab: New tab, then the strip's single stop (the selected tab).
  await page.keyboard.press("Shift+Tab");
  await expectFocusVisible(page.getByRole("button", { name: "New tab" }));
  await page.keyboard.press("Shift+Tab");
  await expectFocusVisible(notes);

  await page.keyboard.press("ArrowLeft");
  await expectFocusVisible(roundtrip);
  await expect(notes).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(roundtrip).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowRight");
  await expectFocusVisible(notes);

  await page.keyboard.press("Delete");
  const prompt = page.getByRole("alertdialog");
  await expect(prompt).toBeVisible();
  await expectFocusVisible(prompt.getByRole("button", { name: "Save", exact: true }));
  await page.keyboard.press("Escape");
  await expect(prompt).toBeHidden();
  await expect(notes).toBeFocused();
});

test("command palette: active option ringed, focus returns (A11Y-03, A11Y-04)", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = editorOf(page);
  await page.getByText("The first line of the notes.").click();
  await expect(editor).toBeFocused();

  await page.keyboard.press("ControlOrMeta+Shift+P");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const input = palette.getByRole("combobox");
  await expect(input).toBeFocused();
  const first = await input.getAttribute("aria-activedescendant");
  await page.keyboard.press("ArrowDown");
  await expect(input).not.toHaveAttribute("aria-activedescendant", first ?? "");
  await expectActiveOptionRing(input);

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(editor).toBeFocused();
});

test("workspace search: ringed field and option, Escape returns (A11Y-04, A11Y-14)", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = editorOf(page);
  await page.getByText("The first line of the notes.").click();

  await page.keyboard.press("ControlOrMeta+Shift+F");
  const search = page.getByRole("combobox", { name: "Search in workspace" });
  await expectFocusVisible(search);
  await page.keyboard.type("first line");
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expectActiveOptionRing(search);

  await page.keyboard.press("Escape");
  await expect(search).toBeHidden();
  await expect(editor).toBeFocused();
});

test("find: focus stays in the bar, Escape returns to the editor", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = editorOf(page);
  await page.getByText("The first line of the notes.").click();

  await page.keyboard.press("ControlOrMeta+f");
  const bar = page.getByRole("search", { name: "Find and replace" });
  await expectFocusVisible(bar.getByRole("textbox", { name: "Find" }));
  await page.keyboard.press("Tab");
  expect(await bar.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(bar).toBeHidden();
  await expect(editor).toBeFocused();
});

test("Settings: search focused, shortcut rows named by action, Escape returns (A11Y-03, A11Y-13)", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = editorOf(page);
  await page.getByText("The first line of the notes.").click();

  await page.keyboard.press("ControlOrMeta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expectFocusVisible(settings.getByRole("textbox", { name: "Search settings" }));
  await expect(
    settings.getByRole("button", { name: "Command palette: Ctrl+Shift+P", exact: true }),
  ).toBeAttached();
  await expect(
    settings.getByRole("button", { name: "Reset Command palette shortcut", exact: true }),
  ).toBeAttached();

  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(editor).toBeFocused();
});

test("New file dialog: name field focused, Escape returns to the button (A11Y-03)", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const newFile = page.getByRole("complementary").getByRole("button", { name: "New file" });
  await newFile.focus();

  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "New file" });
  await expectFocusVisible(dialog.getByRole("textbox"));
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expectFocusVisible(newFile);
});

test("menubar: F10, arrows, ringed items, Escape returns to the tree (A11Y-04, A11Y-16)", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const row = page.getByRole("tree").getByRole("treeitem", { name: "deflist.md" });
  await runCommand(page, "Focus File Tree");
  await expect(row).toBeFocused();

  await page.keyboard.press("F10");
  const menubar = page.getByRole("menubar");
  await expectFocusVisible(menubar.getByRole("menuitem").first());
  await page.keyboard.press("ArrowRight");
  await expectFocusVisible(menubar.getByRole("menuitem", { name: "File" }));
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "File" });
  await expect(menu).toBeVisible();
  await expectFocusVisible(menu.getByRole("menuitem").first());
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("menu", { name: "Edit" })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  // Closing the menu hands focus back to its menubar item (APG Menubar), a
  // task after the menu unmounts: wait for it, or the next Escape lands on
  // <body> and the menubar never sees it.
  await expectFocusVisible(menubar.getByRole("menuitem", { name: "Edit" }));
  await page.keyboard.press("Escape");
  await expect(row).toBeFocused();
});

test("About: opened from Help by keyboard, focus ringed inside, Escape returns to the document", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });

  await page.keyboard.press("F10");
  const menubar = page.getByRole("menubar");
  await expectFocusVisible(menubar.getByRole("menuitem").first());
  await page.keyboard.press("End");
  await expectFocusVisible(menubar.getByRole("menuitem", { name: "Help" }));
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Help" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("End");
  await expectFocusVisible(menu.getByRole("menuitem", { name: "About Asterisco" }));
  await page.keyboard.press("Enter");

  const about = page.getByRole("dialog", { name: "About Asterisco" });
  await expect(about).toBeVisible();
  await expect(about.getByText("Version 1.0.0")).toBeVisible();
  await expectFocusVisible(about.getByRole("button", { name: "Close" }));
  await page.keyboard.press("Tab");
  const check = about.getByRole("button", { name: "Check for updates" });
  await expectFocusVisible(check);
  // Starting the check keeps focus on the button and inside the dialog's trap.
  await page.keyboard.press("Enter");
  await expect(page.getByText("You’re on the latest version").first()).toBeVisible();
  await expectFocusVisible(check);
  await page.keyboard.press("Tab");
  await expectFocusVisible(about.getByRole("button", { name: "Third-party notices" }));

  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  // What opened the dialog was a menu item, gone with its menu: focus falls back
  // to the active document, as for every dialog the menus open (focus-return.ts).
  await expectInkCaret(editorOf(page));
});

/** Running Web Animations on the app mark's parts (docs/brand/logo-e-animazioni.md). */
function markAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) =>
          (animation.effect as KeyframeEffect | null)?.target?.closest(".app-mark"),
        ).length,
  );
}

test("the app mark: still at a cold launch, A2 when About opens, settled after a check", async ({
  app,
}) => {
  const { page } = app;
  await app.launch({ open: [] });
  await expect(page.locator(".app-mark")).toBeVisible();
  expect(await markAnimations(page), "nothing animates at launch").toBe(0);

  // Count what the mark starts, instead of racing a 900 ms animation to see it run.
  await page.evaluate(() => {
    const started = { count: 0 };
    (window as unknown as { __markStarted: typeof started }).__markStarted = started;
    const proto = Element.prototype;
    const original = Object.getOwnPropertyDescriptor(proto, "animate")?.value as (
      this: Element,
      ...args: Parameters<Element["animate"]>
    ) => Animation;
    proto.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      if (this.closest(".app-mark")) started.count += 1;
      return original.apply(this, args);
    };
  });
  const startedOnMark = () =>
    page.evaluate(
      () => (window as unknown as { __markStarted: { count: number } }).__markStarted.count,
    );
  await runCommand(page, "About Asterisco");
  const about = page.getByRole("dialog", { name: "About Asterisco" });
  await expect(about).toBeVisible();
  await expect.poll(startedOnMark).toBeGreaterThan(0);
  await expect.poll(() => markAnimations(page), { timeout: 3000 }).toBe(0);

  // A3 → A4: the mock answers at once, so the loop settles and nothing keeps running.
  await about.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByText("You’re on the latest version").first()).toBeVisible();
  await expect.poll(() => markAnimations(page), { timeout: 3000 }).toBe(0);
});

test("the app mark does not move under reduced motion", async ({ app }) => {
  const { page } = app;
  await page.emulateMedia({ reducedMotion: "reduce" });
  await app.launch({ open: ["notes.md"] });
  await runCommand(page, "About Asterisco");
  const about = page.getByRole("dialog", { name: "About Asterisco" });
  await expect(about).toBeVisible();
  expect(await markAnimations(page)).toBe(0);
  // The check (A3, A4) does not move it either; the words still say what happens.
  await about.getByRole("button", { name: "Check for updates" }).click();
  await expect(page.getByText("You’re on the latest version").first()).toBeVisible();
  expect(await markAnimations(page)).toBe(0);
});

test("images are named by their alt text in Edit and Reading view (A11Y-02)", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["images.md"] });
  const panel = page.getByRole("tabpanel");

  for (const view of ["Edit", "Reading"]) {
    await page.getByRole("radio", { name: view }).click();
    for (const name of ["Architecture", "Overview", "diagram"]) {
      await expect(panel.getByRole("img", { name, exact: true })).toBeVisible();
    }
  }
});

test("reduced motion hides the sidebar at once; dark scheme follows the system", async ({
  app,
}) => {
  const { page } = app;
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await app.launch({ open: ["notes.md"] });
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);

  const sidebar = page.getByRole("complementary", { name: "File tree" });
  await expect(sidebar).toBeVisible();
  await editorOf(page).focus();
  await page.keyboard.press("ControlOrMeta+Shift+L");
  // No width animation: gone by the second frame (one to commit, one to paint).
  const width = await page.evaluate(
    () =>
      new Promise<number>((done) =>
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            const aside = document.querySelector('aside[aria-label="File tree"]');
            done(aside?.parentElement?.getBoundingClientRect().width ?? 0);
          }),
        ),
      ),
  );
  expect(width).toBe(0);
});

test("reflows at 320 CSS px: no horizontal scroll, a usable document column (A11Y-12)", async ({
  app,
}) => {
  const { page } = app;
  await page.setViewportSize({ width: 320, height: 256 });
  await app.launch({ open: ["notes.md"] });

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  expect((await editorOf(page).boundingBox())?.width).toBeGreaterThanOrEqual(280);
});

test.describe("the floating sidebar at 320 CSS px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
  });

  test("Escape closes it and focus returns to where it was", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    const sidebar = page.getByRole("complementary", { name: "File tree" });
    const tab = page.getByRole("tab", { name: "notes.md" });
    await expect(sidebar).toBeVisible();

    // From the tab strip back into the sidebar, then out with Escape.
    await page.getByRole("button", { name: "New tab" }).focus();
    await page.keyboard.press("Shift+Tab");
    await expect(tab).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(sidebar.getByRole("separator", { name: "Resize sidebar" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expectFocusVisible(tab);
  });

  test("with nothing to return to, focus goes to the editor", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    const sidebar = page.getByRole("complementary", { name: "File tree" });

    await runCommand(page, "Focus File Tree");
    await expect(sidebar.getByRole("treeitem").first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(editorOf(page)).toBeFocused();

    // Closed with its own toggle, it hands focus back too.
    await page.keyboard.press("ControlOrMeta+Shift+L");
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole("button", { name: "Toggle sidebar" }).focus();
    await page.keyboard.press("Enter");
    await expect(sidebar).toBeHidden();
    await expect(editorOf(page)).toBeFocused();
  });
});

test("Escape leaves the docked sidebar open", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const sidebar = page.getByRole("complementary", { name: "File tree" });
  const row = sidebar.getByRole("treeitem").first();

  await runCommand(page, "Focus File Tree");
  await expect(row).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeVisible();
  await expect(row).toBeFocused();
});

test("closing the docked sidebar from a tree row keeps focus in the editor", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const sidebar = page.getByRole("complementary", { name: "File tree" });

  await runCommand(page, "Focus File Tree");
  await expect(sidebar.getByRole("treeitem").first()).toBeFocused();
  await page.keyboard.press("ControlOrMeta+Shift+L");
  await expect(sidebar).toBeHidden();
  await expect(editorOf(page)).toBeFocused();
});
