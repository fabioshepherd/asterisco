import { readFileSync } from "node:fs";
import path from "node:path";

import { type App, expect, fixture, test, workspacePath } from "./support/fixtures";

const TYPED = "A line typed by the test.";

function editorLabel(language: "en" | "it", key: string, ns: "editor" | "menu" = "editor"): string {
  const file = path.join(import.meta.dirname, "..", "src/i18n/locales", language, `${ns}.json`);
  let node: unknown = JSON.parse(readFileSync(file, "utf8"));
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  if (typeof node !== "string") throw new Error(`missing i18n key ${language}/${ns}/${key}`);
  return node;
}

/** Ctrl+S on a document with no unsaved changes: reported as saved, nothing written. */
async function saveWritesNothing(app: App): Promise<void> {
  const { page } = app;
  await page.keyboard.press("ControlOrMeta+s");
  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText(editorLabel("en", "notify.saved")),
  ).toBeVisible();
  expect((await app.mock()).writes).toEqual([]);
}

/** Type at the very end of the document, whose last block holds `lastLine`, then save. */
async function appendAndSave(app: App, lastLine: string, typed: string): Promise<void> {
  const { page } = app;
  await page.locator(".ProseMirror").getByText(lastLine).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(typed);
  await page.keyboard.press("ControlOrMeta+s");
  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
}

test("open edit save", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(TYPED);
  // The editor reports edits to the store on a 200 ms debounce; saving inside
  // that window writes the pre-edit text (gate-snapshot W0-KD-1). Save once the tab
  // shows the edit, as a user watching the unsaved marker would.
  await expect(page.getByRole("tab", { name: "notes.md, unsaved changes" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.path).toBe(workspacePath("notes.md"));
  expect(write?.contents).toBe(`${fixture("notes.md").trimEnd()}\n\n${TYPED}\n`);
});

test("unedited round trip", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md"] });
  // The editor has parsed and serialized the document (baseline adopted) once
  // its rich blocks are on screen.
  await expect(page.locator(".ProseMirror").getByRole("cell", { name: "Tables" })).toBeVisible();
  await expect(page.locator(".ProseMirror").getByText("Definition of the term.")).toBeVisible();

  await page.locator(".ProseMirror h1").click();
  await saveWritesNothing(app);

  // An edit in the last paragraph writes every other block back byte for byte.
  await appendAndSave(app, "The end.", " More.");
  const [write] = (await app.mock()).writes;
  expect(write?.path).toBe(workspacePath("roundtrip.md"));
  expect(write?.contents).toBe(fixture("roundtrip.md").replace("The end.", "The end. More."));
});

// A Windows file stays CRLF, keeps its BOM and its missing final newline (CODE-02).
test("a CRLF file with a BOM and no final newline keeps them", async ({ app }) => {
  const { page } = app;
  const source = "\uFEFF# Windows\r\n\r\n- one\r\n- two\r\n\r\nThe last line.";
  await app.launch({ open: ["windows.md"], files: { "windows.md": source } });
  await expect(page.locator(".ProseMirror").getByText("The last line.")).toBeVisible();

  await page.locator(".ProseMirror h1").click();
  await saveWritesNothing(app);

  await appendAndSave(app, "The last line.", " Edited.");
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(source.replace("The last line.", "The last line. Edited."));
});

test("view switch", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const panel = page.getByRole("tabpanel");

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(TYPED);

  await page.getByRole("radio", { name: "Reading" }).click();
  await expect(panel).toHaveAttribute("data-view", "reading");
  await expect(panel.getByText(TYPED)).toBeVisible();

  await page.getByRole("radio", { name: "Source" }).click();
  await expect(panel).toHaveAttribute("data-view", "source");
  await expect(panel.locator(".cm-content")).toContainText(TYPED);
  await expect(panel.locator(".cm-content")).toContainText("The first line of the notes.");

  await page.getByRole("radio", { name: "Edit" }).click();
  await expect(panel).toHaveAttribute("data-view", "edit");
  await expect(panel.locator(".ProseMirror")).toContainText(TYPED);
  await expect(panel.locator(".ProseMirror")).toContainText("The first line of the notes.");
});

test("editors are named; Reading view is read-only and focusable", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const panel = page.getByRole("tabpanel");
  const editor = panel.getByRole("textbox", { name: "notes.md", exact: true });

  await expect(editor).toBeVisible();
  await expect(editor).not.toHaveAttribute("aria-readonly");
  await expect(panel).not.toHaveAttribute("tabindex");

  await page.getByRole("radio", { name: "Reading" }).click();
  await expect(editor).toHaveAttribute("aria-readonly", "true");
  await expect(panel).toHaveAttribute("tabindex", "0");

  await page.getByRole("radio", { name: "Source" }).click();
  await expect(panel.getByRole("textbox", { name: "notes.md, Markdown source" })).toBeVisible();
});

test("links in Reading view open outside the app window", async ({ app }) => {
  const { page } = app;
  await app.launch({
    open: ["links.md"],
    files: {
      "links.md":
        "# Links\n\n[remote](https://example.org/x) [rel](./notes.md) [gone](./gone.md)\n",
    },
  });
  const panel = page.getByRole("tabpanel");
  await page.getByRole("radio", { name: "Reading" }).click();
  await expect(panel).toHaveAttribute("data-view", "reading");
  const appUrl = page.url();

  await panel.getByRole("link", { name: "remote" }).click();
  await expect.poll(async () => (await app.mock()).openedUrls).toEqual(["https://example.org/x"]);
  expect(page.url()).toBe(appUrl);

  await panel.getByRole("link", { name: "rel" }).click();
  await expect(page.getByRole("tab", { name: "notes.md", selected: true })).toBeVisible();
  await expect(panel.locator(".ProseMirror")).toContainText("The first line of the notes.");
  expect(page.url()).toBe(appUrl);

  await page.getByRole("tab", { name: "links.md" }).click();
  await panel.getByRole("link", { name: "gone" }).click();
  await expect(
    page
      .getByRole("region", { name: "Notifications" })
      .getByText(editorLabel("en", "notify.fileMissing")),
  ).toBeVisible();
  expect(page.url()).toBe(appUrl);
  expect((await app.mock()).openedUrls).toEqual(["https://example.org/x"]);
});

test("Crepe's icon-only controls are named", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const panel = page.getByRole("tabpanel");

  await page.getByText("The first line of the notes.").hover();
  // The block handle is pointer-only (not focusable, no keyboard handler): it is
  // hidden from assistive tech, not exposed as buttons that do nothing.
  await expect(panel.locator(".milkdown-block-handle")).toHaveAttribute("aria-hidden", "true");
  await expect(panel.getByRole("button", { name: /add block|drag/i })).toHaveCount(0);

  // The selection toolbar is labelled through its feature config (it is
  // rendered, hidden, until text is selected).
  await expect(panel.locator('.milkdown-toolbar [data-toolbar-item="bold"]')).toHaveAttribute(
    "aria-label",
    editorLabel("en", "toolbar.bold"),
  );
  // Decorative icons stay out of the accessibility tree.
  expect(await panel.locator(".milkdown-icon svg:not([aria-hidden='true'])").count()).toBe(0);
});

test("view switch with two documents open", async ({ app }) => {
  const { page } = app;
  // Opening two files mounts and replaces the first document's editor while it
  // is still being created; its late `mounted` callback must not leave a
  // destroyed instance registered for that document.
  await app.launch({ open: ["roundtrip.md", "notes.md"] });
  const panel = page.getByRole("tabpanel");

  await page.getByRole("tab", { name: /roundtrip/ }).click();
  await expect(panel.locator(".ProseMirror")).toContainText("Round trip");

  await page.getByRole("radio", { name: "Source" }).click();
  await expect(panel).toHaveAttribute("data-view", "source");
  await expect(panel.locator(".source-editor .cm-content")).toContainText("# Round trip");
  await expect(panel.locator(".source-editor .cm-content")).toContainText(
    "A paragraph with **bold**",
  );

  await page.getByRole("radio", { name: "Reading" }).click();
  await expect(panel).toHaveAttribute("data-view", "reading");
  await expect(panel.locator(".ProseMirror")).toContainText("A paragraph with bold");

  await page.getByRole("radio", { name: "Edit" }).click();
  await expect(panel).toHaveAttribute("data-view", "edit");
  await expect(panel.locator(".ProseMirror")).toContainText("Round trip");
  await expect(panel.locator(".ProseMirror")).toContainText("A paragraph with bold");
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});

test("workspace search", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md"] });

  await page.keyboard.press("ControlOrMeta+Shift+F");
  const search = page.getByRole("combobox", { name: "Search in workspace" });
  await expect(search).toBeFocused();
  await search.fill("first line");

  const hits = page.getByRole("group", { name: "notes.md" });
  await expect(hits.getByRole("option")).toHaveCount(1);
  await expect(hits.getByRole("option")).toContainText("The first line of the notes.");
});

test("command palette", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const panel = page.getByRole("tabpanel");
  await expect(panel).toHaveAttribute("data-view", "edit");

  await page.keyboard.press("ControlOrMeta+Shift+P");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await page.keyboard.type("Reading Mode");
  await expect(palette.getByRole("option", { name: "Reading Mode" })).toBeVisible();
  await page.keyboard.press("Enter");

  await expect(palette).toBeHidden();
  await expect(panel).toHaveAttribute("data-view", "reading");
});

test("export html", async ({ app }) => {
  const { page } = app;
  const target = workspacePath("unsafe.html");
  await app.launch({ open: ["unsafe.md"], language: "it", saveDialog: [target] });

  await page.keyboard.press("ControlOrMeta+Shift+P");
  await page.keyboard.type(editorLabel("it", "file.export.html", "menu"));
  await page.keyboard.press("Enter");

  await expect
    .poll(async () => (await app.mock()).writes.map((write) => write.path))
    .toEqual([target]);
  const html = (await app.mock()).files[target] ?? "";
  expect(html).toMatch(/<html lang="it">/);
  expect(html).toContain("Export check");
  // The fixture's script, event handler and javascript: URL are sanitized away.
  expect(html).not.toContain("__pwned");
  expect(html).not.toMatch(/<script/i);
  expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  expect(html).not.toContain("javascript:");
  expect(await page.evaluate(() => "__pwned" in window)).toBe(false);
});

test("save right after typing writes the latest text", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type(TYPED);
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toContain(TYPED);
});

test("unedited round trip keeps image alt text", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["images.md"] });
  await expect(page.locator(".ProseMirror").getByText("inside a sentence.")).toBeVisible();

  await page.locator(".ProseMirror h1").click();
  await saveWritesNothing(app);

  await appendAndSave(app, "inside a sentence.", " More.");
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(
    fixture("images.md").replace("inside a sentence.", "inside a sentence. More."),
  );
});

test("image alt text is rendered and editable", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["images.md"] });
  const editor = page.locator(".ProseMirror");
  // The image's name is its Markdown alt, not its title (caption).
  const architecture = editor.getByRole("img", { name: "Architecture", exact: true });
  await expect(architecture).toBeVisible();
  await expect(editor.getByRole("img", { name: "Overview", exact: true })).toBeVisible();

  await architecture.click();
  const field = editor.getByRole("textbox", { name: editorLabel("en", "imageBlock.altLabel") });
  await field.fill("System overview");
  await field.press("Enter");
  await expect(page.getByRole("tab", { name: "images.md, unsaved changes" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(
    fixture("images.md").replace("![Architecture](", "![System overview]("),
  );
});

// An edit in one place must not rewrite the rest of the file (V1-17).
test("an edit keeps <br> lines, `-` bullets and task items elsewhere as they were", async ({
  app,
}) => {
  const { page } = app;
  const source = [
    "# Fidelity",
    "",
    "The edited line.",
    "",
    "<br>",
    "",
    "- one",
    "- two",
    "  - nested",
    "",
    "<br />",
    "",
    "- [ ] open task",
    "- [x] done task",
    "",
    "1. first",
    "2. second",
    "",
  ].join("\n");
  await app.launch({ open: ["fidelity.md"], files: { "fidelity.md": source } });

  await page.getByText("The edited line.").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" More.");
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(source.replace("The edited line.", "The edited line. More."));
});

test("the status bar counts a selection as soon as it is made", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });

  await page.getByText("The first line of the notes.").dblclick({ position: { x: 4, y: 4 } });
  await expect(page.getByText("1 word selected")).toBeVisible();
});

// Text that looks like a definition list is plain paragraph text and survives untouched.
test("unedited round trip leaves definition-list-looking text untouched", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["deflist.md"] });
  await expect(page.locator(".ProseMirror").getByText("Last definition")).toBeVisible();

  await saveWritesNothing(app);

  await appendAndSave(app, "Last definition, as the final block.", " More.");
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(
    fixture("deflist.md").replace("the final block.", "the final block. More."),
  );
});

test("Tab in a paragraph moves focus out of the editor without editing", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = page.locator(".ProseMirror");

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await expect(editor).toBeFocused();
  await page.keyboard.press("Tab");

  // Focus left the editor (WCAG 2.1.2) and no spaces were written.
  await expect(editor).not.toBeFocused();
  expect(await editor.evaluate((node) => node.contains(document.activeElement))).toBe(false);
  await expect(editor.locator("p").first()).toHaveText("The first line of the notes.");
  // Past the editor's 200 ms change debounce, the document is still clean.
  await page.waitForTimeout(500);
  await expect(page.getByRole("tab", { name: "notes.md", exact: true })).toBeVisible();
});

test("Tab in a list item still nests it", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });
  const editor = page.locator(".ProseMirror");

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- Alpha");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Beta");
  // Typing straight into a just-created item keeps the caret at its end (it
  // used to jump to the start: "Beta" became "etaB", W2-KL-1).
  await expect(editor.locator("li")).toHaveText(["Alpha", "Beta"]);
  await expect(editor.locator("li li")).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(editor.locator("li li")).toHaveText("Beta");
  await expect(editor).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(editor.locator("li li")).toHaveCount(0);
  await expect(editor).toBeFocused();
});

test("task list items render, toggle and round-trip", async ({ app }) => {
  const { page } = app;
  const source = "# Tasks\n\n- [ ] open task\n- [x] done task\n";
  await app.launch({ open: ["tasks.md"], files: { "tasks.md": source } });
  const panel = page.getByRole("tabpanel");
  const open = page.locator('.ProseMirror li[data-item-type="task"]', { hasText: "open task" });
  const done = page.locator('.ProseMirror li[data-item-type="task"]', { hasText: "done task" });
  await expect(open).toHaveAttribute("data-checked", "false");
  await expect(done).toHaveAttribute("data-checked", "true");
  await saveWritesNothing(app);

  // Reading view shows the state but does not toggle.
  await page.getByRole("radio", { name: "Reading" }).click();
  await expect(panel).toHaveAttribute("data-view", "reading");
  await open.click({ position: { x: -12, y: 12 } });
  await expect(open).toHaveAttribute("data-checked", "false");

  // The checkbox sits in the marker gutter, left of the item's text.
  await page.getByRole("radio", { name: "Edit" }).click();
  await open.click({ position: { x: -12, y: 12 } });
  await expect(open).toHaveAttribute("data-checked", "true");
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(source.replace("- [ ] open task", "- [x] open task"));
});

test("the slash menu's task list command creates a task item that round-trips", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["notes.md"] });

  await page.getByText("The first line of the notes.").click();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("/");
  await page.getByText(editorLabel("en", "slashMenu.taskList"), { exact: true }).click();
  await page.keyboard.type("Ship it");
  await expect(
    page.locator('.ProseMirror li[data-item-type="task"][data-checked="false"]'),
  ).toHaveText("Ship it");
  await page.keyboard.press("ControlOrMeta+s");

  await expect.poll(async () => (await app.mock()).writes.length).toBe(1);
  const [write] = (await app.mock()).writes;
  expect(write?.contents).toBe(`${fixture("notes.md").trimEnd()}\n\n- [ ] Ship it\n`);
});

test("code blocks are shown once, highlighted by the editor", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md"] });
  const blocks = page.locator(".ProseMirror .milkdown-code-block");
  const code = blocks.filter({ hasText: "const answer" });
  const diagram = blocks.filter({ has: page.locator(".mermaid-preview, .mermaid-error") });

  for (const view of ["Edit", "Reading"]) {
    await page.getByRole("radio", { name: view }).click();
    // A plain fence gets no preview panel; its CodeMirror view carries the colours.
    await expect(code.locator(".cm-content")).toContainText("const answer: number = 42;");
    await expect(code.locator(".preview-panel")).toHaveCount(0);
    expect(await code.locator(".cm-content span[class]").count()).toBeGreaterThan(0);
    // Mermaid keeps its diagram preview.
    await expect(diagram).toHaveCount(1);
  }
});

test("typing in a Mermaid block keeps its diagram on screen (EDITOR-05)", async ({ app }) => {
  const { page } = app;
  await app.launch({ open: ["roundtrip.md"] });
  const block = page
    .locator(".ProseMirror .milkdown-code-block")
    .filter({ has: page.locator(".mermaid-preview") });
  await expect(block.locator(".mermaid-preview")).toBeVisible();
  // Record whether the preview panel ever empties while the source changes. A
  // half-typed arrow is a parse error, so the error node counts as a preview.
  await block.evaluate((node) => {
    const flags = window as unknown as { __diagramGone: boolean };
    flags.__diagramGone = false;
    new MutationObserver(() => {
      if (!node.querySelector(".mermaid-preview, .mermaid-error")) flags.__diagramGone = true;
    }).observe(node, { childList: true, subtree: true });
  });

  await block.locator(".cm-content").getByText("A --> B").click();
  await page.keyboard.press("End");
  await page.keyboard.type(" --> C");
  await expect(block.locator(".mermaid-preview")).toContainText("C");
  expect(
    await page.evaluate(() => (window as unknown as { __diagramGone: boolean }).__diagramGone),
  ).toBe(false);
});

test("a Mermaid diagram with math renders through KaTeX (CODE-08)", async ({ app }) => {
  const { page } = app;
  // Guards mermaid + KaTeX together (any upgrade of either, and the package.json
  // override that gives mermaid the app's KaTeX). Sequence messages go through
  // KaTeX whatever `htmlLabels` says, with throwOnError, so a KaTeX mermaid
  // cannot drive turns the preview into the error block.
  await app.launch({
    open: ["math.md"],
    files: { "math.md": "```mermaid\nsequenceDiagram\n  Alice->>Bob: $$x^2$$\n```\n" },
  });
  const block = page.locator(".ProseMirror .milkdown-code-block");
  await expect(block.locator(".mermaid-preview")).toBeVisible();
  await expect(block.locator(".mermaid-error")).toHaveCount(0);
  await expect(block.locator(".mermaid-preview line[data-et='message']")).toHaveCount(1);
});

test("controls Crepe renders later are still named (EDITOR-07)", async ({ app }) => {
  const { page } = app;
  await app.launch({
    open: ["linked.md"],
    files: {
      "linked.md": "| a | b |\n| - | - |\n| 1 | 2 |\n\nSee [the site](https://example.com).\n",
    },
  });
  const panel = page.getByRole("tabpanel", { name: "linked.md" });
  // Table handles mount after the first label pass, so the observer names them.
  await expect(
    panel.locator(`[aria-label="${editorLabel("en", "controls.deleteRow")}"]`),
  ).not.toHaveCount(0);
  // The link tooltip is mounted on hover, after the editor rendered.
  await panel.getByText("the site").hover();
  for (const key of ["copyLink", "editLink", "removeLink"]) {
    await expect(
      panel.locator(`[role="button"][aria-label="${editorLabel("en", `controls.${key}`)}"]`),
    ).toHaveCount(1);
  }
});

test.describe("focus returns after a surface closes", () => {
  test("command palette: Escape, and after running a command", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    const panel = page.getByRole("tabpanel");
    const editor = page.locator(".ProseMirror");
    await page.getByText("The first line of the notes.").click();
    await expect(editor).toBeFocused();

    await page.keyboard.press("ControlOrMeta+Shift+P");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await expect(editor).toBeFocused();

    // The editor turns read-only, so focus lands on the Reading panel instead.
    await page.keyboard.press("ControlOrMeta+Shift+P");
    await page.keyboard.type("Reading Mode");
    await page.keyboard.press("Enter");
    await expect(panel).toHaveAttribute("data-view", "reading");
    await expect(panel).toBeFocused();
  });

  test("command palette: a command that moves focus keeps it", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await page.getByText("The first line of the notes.").click();

    await page.keyboard.press("ControlOrMeta+Shift+P");
    await page.keyboard.type("Focus File Tree");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("treeitem").first()).toBeFocused();
  });

  test("Settings: Escape and the Close button", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    const editor = page.locator(".ProseMirror");
    const settings = page.getByRole("dialog", { name: "Settings" });
    await page.getByText("The first line of the notes.").click();

    await page.keyboard.press("ControlOrMeta+Comma");
    await expect(page.getByRole("textbox", { name: "Search settings" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    await expect(editor).toBeFocused();

    await page.keyboard.press("ControlOrMeta+Comma");
    await settings.getByRole("button", { name: "Close settings" }).click();
    await expect(settings).toBeHidden();
    await expect(editor).toBeFocused();
  });

  test("New file dialog: Escape", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    const newFile = page.getByRole("complementary").getByRole("button", { name: "New file" });

    await newFile.click();
    const dialog = page.getByRole("dialog", { name: "New file" });
    await expect(dialog.getByRole("textbox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(newFile).toBeFocused();
  });

  test("menubar: Escape returns to the Source editor it came from", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await page.getByRole("radio", { name: "Source" }).click();
    const source = page.locator("#document-panel .cm-content").last();
    await source.click();
    await expect(source).toBeFocused();

    await page.keyboard.press("F10");
    const firstTrigger = page.getByRole("menubar").getByRole("menuitem").first();
    await expect(firstTrigger).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(source).toBeFocused();
  });

  test("palette: Focus notifications reaches the newest toast", async ({ app }) => {
    const { page } = app;
    await app.launch({ open: ["notes.md"] });
    await page.getByText("The first line of the notes.").click();
    await page.keyboard.press("End");
    await page.keyboard.type("!");
    await expect(page.getByRole("tab", { name: "notes.md, unsaved changes" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+s");
    const region = page.getByRole("region", { name: "Notifications" });
    await expect(region).toBeVisible();

    await page.keyboard.press("ControlOrMeta+Shift+P");
    await page.keyboard.type("Focus Notifications");
    await page.keyboard.press("Enter");
    await expect(region.getByRole("button", { name: "Dismiss" })).toBeFocused();
  });
});

test("reflows at 320 CSS px (minimum window at 200% zoom)", async ({ app }) => {
  const { page } = app;
  await page.setViewportSize({ width: 320, height: 640 });
  await app.launch({ open: ["notes.md"] });
  const main = page.getByRole("main");
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // The sidebar floats over the document instead of leaving it a sliver.
  await expect(page.getByRole("complementary", { name: "File tree" })).toBeVisible();
  expect((await main.boundingBox())?.width).toBeGreaterThanOrEqual(300);
  expect(await noHorizontalScroll()).toBe(true);

  // The path gives way before it reaches the save state.
  const footer = page.getByRole("contentinfo");
  const pathBox = await footer.locator("[title='/work/notes.md']").boundingBox();
  const savedBox = await footer.getByText("Saved").boundingBox();
  if (!pathBox || !savedBox) throw new Error("status bar path or save state not rendered");
  const apart =
    pathBox.x + pathBox.width <= savedBox.x ||
    savedBox.x + savedBox.width <= pathBox.x ||
    pathBox.y + pathBox.height <= savedBox.y ||
    savedBox.y + savedBox.height <= pathBox.y;
  expect(apart).toBe(true);
  expect(pathBox.x + pathBox.width).toBeLessThanOrEqual(320);

  // Settings floats too, and fits the window.
  await page.keyboard.press("ControlOrMeta+Comma");
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings).toBeVisible();
  expect((await settings.boundingBox())?.width).toBeLessThanOrEqual(320);
  expect((await main.boundingBox())?.width).toBeGreaterThanOrEqual(300);
  expect(await noHorizontalScroll()).toBe(true);
});
