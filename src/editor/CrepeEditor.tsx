import { Crepe } from "@milkdown/crepe";
import { setCodeMirrorTheme } from "@milkdown/crepe/feature/code-mirror";
import { EditorStatus, editorViewOptionsCtx } from "@milkdown/kit/core";
import { indentPlugin } from "@milkdown/kit/plugin/indent";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { currentPlatform } from "@/app/platform";
import { refreshActiveSearch } from "@/features/find-replace/use-find-replace";
import { useSelection } from "@/stores/selection";
import { useUi } from "@/stores/ui";

import {
  clearActiveEditorIf,
  registerEditor,
  setActiveEditor,
  unregisterEditor,
} from "./active-editor";
import { autoPairingPlugin } from "./auto-pairing";
import {
  clearSearchControllerIf,
  type EditorSearchController,
  setSearchController,
} from "./editor-search";
import { viewFromCtx } from "./editor-view";
import { renderCodeBlockPreview } from "./code-block-preview";
import { codeBlockTheme } from "./code-theme";
import { observeCrepeControls } from "./crepe-control-labels";
import {
  footnoteCompletionPlugin,
  footnoteInputRule,
  registerFootnoteDecorations,
  registerFootnoteInteraction,
} from "./footnotes";
import { configFormattingShortcuts, footnoteKeymap, linkShortcutKeymap } from "./formatting-keymap";
import { frontmatterSchema, remarkFrontmatterPlugin } from "./frontmatter";
import { imageBlockAltText, keepImageBlockAlt } from "./image-block-alt";
import { resolveImageSrc, uploadImage } from "./image-upload";
import { linkInputRule } from "./link-input-rule";
import { configureMarkdownFidelity } from "./markdown-fidelity";
import { reportSelection } from "./selection-report";
import { taskListToggle } from "./task-list";
import { createWysiwygSearchController, registerFindDecorations } from "./wysiwyg-search";
import "@/styles/editor-theme.css";

export interface CrepeEditorProps {
  /**
   * Id of the document this editor renders. Used to register the live instance
   * in the by-doc registry so the file watcher can push external content into
   * every live instance of the doc (e.g. across a StrictMode remount).
   */
  docId: string;
  /** Accessible name of the editing surface (the document's name). */
  ariaLabel: string;
  /** Initial markdown loaded into the editor (uncontrolled afterwards). */
  defaultValue: string;
  /** Called with the full markdown on every content change. */
  onChange: (markdown: string) => void;
  /** Called when the editor loses focus (after onChange flushes the store). */
  onBlur?: () => void;
  /**
   * Called once the editor is mounted, with its normalized serialization of
   * `defaultValue`. Used to establish the clean baseline (open shouldn't dirty).
   */
  onReady?: (markdown: string) => void;
}

/** Inner editor — must live under a MilkdownProvider. */
function MilkdownEditor({
  docId,
  ariaLabel,
  defaultValue,
  onChange,
  onBlur,
  onReady,
}: CrepeEditorProps) {
  const { t } = useTranslation("editor");

  // Keep the latest doc id reachable from listener/cleanup closures without
  // re-creating the editor when it changes (BoundEditor remounts on id change,
  // but a ref keeps register/unregister symmetric regardless).
  const docIdRef = useRef(docId);
  docIdRef.current = docId;

  // Keep the latest callbacks reachable without re-creating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const viewMode = useUi((state) => state.viewMode);

  // Read by the ProseMirror `attributes` prop, which is re-evaluated on every
  // view update (see the effect below for name changes).
  const ariaLabelRef = useRef(ariaLabel);
  ariaLabelRef.current = ariaLabel;

  // This editor's Crepe instance, captured so the unmount cleanup can release the
  // active-editor slot for exactly this instance (StrictMode remounts overlap).
  const crepeRef = useRef<Crepe | null>(null);

  // Instances whose unmount cleanup has already run. Milkdown destroys an editor
  // asynchronously and `listener.mounted` fires when `create()` settles, so an
  // editor unmounted mid-creation (a tab replaced right after it opened) would
  // otherwise register itself AFTER its cleanup and stay in the by-doc registry
  // and the active slot as a destroyed instance whose `getMarkdown()` throws.
  const disposedRef = useRef(new WeakSet<Crepe>());

  // One stateless Find controller for this editor (re-reads the live view), kept
  // stable across renders.
  const searchControllerRef = useRef<EditorSearchController | null>(null);
  if (!searchControllerRef.current) {
    searchControllerRef.current = createWysiwygSearchController();
  }

  // Disposer of the observer that names Crepe's icon-only controls.
  const releaseControlLabelsRef = useRef<(() => void) | null>(null);

  useEditor((root) => {
    const crepe = new Crepe({
      root,
      defaultValue,
      features: {
        // Keep AI and the fixed top bar off for the local-first MVP.
        [Crepe.Feature.AI]: false,
        [Crepe.Feature.TopBar]: false,
        // Plain lists: Crepe's list-item block mounts one Vue app per item (slow
        // on long lists) and replays a caret captured at mount one frame later,
        // which sent typing to the start of a just-created item ("Beta" became
        // "etaB"). Markers come from CSS; task items toggle via task-list.ts.
        [Crepe.Feature.ListItem]: false,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: t("placeholder"),
          mode: "doc",
        },
        [Crepe.Feature.CodeMirror]: {
          renderPreview: renderCodeBlockPreview,
          searchPlaceholder: t("codeBlock.searchLanguage"),
          noResultText: t("codeBlock.noResult"),
          copyText: t("codeBlock.copy"),
          previewLabel: t("codeBlock.preview"),
          // Shown only while a block's first async (Mermaid) preview renders.
          previewLoading: t("codeBlock.previewLoading"),
          previewToggleText: (previewOnly) =>
            previewOnly ? t("codeBlock.previewEdit") : t("codeBlock.previewHide"),
        },
        // Math (KaTeX) — Crepe's built-in Latex feature is enabled by default.
        // It registers AFTER CodeMirror (feature order in Crepe), so its
        // renderPreview wraps ours: a `latex` code block renders as KaTeX while
        // every other language gets no preview (see code-block-preview.ts). Inline
        // `$…$` and block `$$…$$` round-trip via remark-math. CodeMirror must
        // stay enabled or the Latex feature throws. KaTeX CSS + fonts are pulled
        // in by the Crepe theme import in editor-theme.css and bundled by Vite.
        // Custom macros can be added here later (e.g. from settings).
        [Crepe.Feature.Latex]: {
          katexOptions: {},
        },
        // The slash menu is the editor's main insertion surface and its labels
        // are Crepe's English defaults unless every one is passed here. Icons
        // are left alone — only the text is ours to translate.
        [Crepe.Feature.BlockEdit]: {
          textGroup: {
            label: t("slashMenu.groups.text"),
            text: { label: t("slashMenu.text") },
            h1: { label: t("slashMenu.h1") },
            h2: { label: t("slashMenu.h2") },
            h3: { label: t("slashMenu.h3") },
            h4: { label: t("slashMenu.h4") },
            h5: { label: t("slashMenu.h5") },
            h6: { label: t("slashMenu.h6") },
            quote: { label: t("slashMenu.quote") },
            divider: { label: t("slashMenu.divider") },
          },
          listGroup: {
            label: t("slashMenu.groups.list"),
            bulletList: { label: t("slashMenu.bulletList") },
            orderedList: { label: t("slashMenu.orderedList") },
            taskList: { label: t("slashMenu.taskList") },
          },
          advancedGroup: {
            label: t("slashMenu.groups.advanced"),
            image: { label: t("slashMenu.image") },
            codeBlock: { label: t("slashMenu.codeBlock") },
            table: { label: t("slashMenu.table") },
            math: { label: t("slashMenu.math") },
          },
        },
        // Selection toolbar: every button's accessible name and tooltip.
        [Crepe.Feature.Toolbar]: {
          boldLabel: t("toolbar.bold"),
          italicLabel: t("toolbar.italic"),
          strikethroughLabel: t("toolbar.strikethrough"),
          codeLabel: t("toolbar.code"),
          latexLabel: t("toolbar.math"),
          linkLabel: t("toolbar.link"),
        },
        // Only the input placeholder is text; editButton/removeButton/
        // confirmButton take icon markup, not labels.
        [Crepe.Feature.LinkTooltip]: {
          inputPlaceholder: t("linkTooltip.placeholder"),
        },
        // Images: save dropped/pasted files to assets/ next to the doc and store
        // a portable relative link; resolve that link to a displayable asset URL.
        [Crepe.Feature.ImageBlock]: {
          onUpload: uploadImage,
          blockOnUpload: uploadImage,
          inlineOnUpload: uploadImage,
          proxyDomURL: resolveImageSrc,
          // Upload/confirm buttons take markup (sanitized by Crepe); plain
          // localized text is valid markup. Icons stay Crepe's.
          blockUploadButton: t("imageBlock.uploadButton"),
          inlineUploadButton: t("imageBlock.inlineUploadButton"),
          blockConfirmButton: t("imageBlock.confirm"),
          blockUploadPlaceholderText: t("imageBlock.uploadPlaceholder"),
          inlineUploadPlaceholderText: t("imageBlock.uploadPlaceholder"),
          blockCaptionPlaceholderText: t("imageBlock.captionPlaceholder"),
        },
      },
    });
    crepeRef.current = crepe;

    // Block handle, table handles and link tooltip take no labels in their
    // configs: name them once Crepe renders them (see crepe-control-labels.ts).
    releaseControlLabelsRef.current?.();
    releaseControlLabelsRef.current = observeCrepeControls(root, {
      alignLeft: t("controls.alignLeft"),
      alignCenter: t("controls.alignCenter"),
      alignRight: t("controls.alignRight"),
      deleteColumn: t("controls.deleteColumn"),
      deleteRow: t("controls.deleteRow"),
      addRow: t("controls.addRow"),
      addColumn: t("controls.addColumn"),
      linkInput: t("controls.linkInput"),
      confirmLink: t("controls.confirmLink"),
      copyLink: t("controls.copyLink"),
      editLink: t("controls.editLink"),
      removeLink: t("controls.removeLink"),
    });

    // On macOS the native Format menu owns the formatting key-equivalents, so the
    // webview keymap is disabled there to avoid double-firing; Windows/Linux keep
    // the editor-scoped keymap (the native menu carries no format accelerators).
    const isMac = currentPlatform() === "mac";

    // Front matter is parsed/serialized as a YAML node and rendered as a
    // read-only collapsible block (registered on the underlying Milkdown editor).
    // Token-based code-block theme instead of Crepe's default `oneDark`. Set through
    // Crepe's own `setCodeMirrorTheme` (a config step, after the feature's) rather
    // than `featureConfigs.theme`: Crepe merges feature configs with lodash
    // `defaultsDeep`, which would deep-merge `oneDark` into our extension objects.
    crepe.editor
      .config(setCodeMirrorTheme(codeBlockTheme))
      // Name the editing surface after the document and mark it read-only in
      // Reading view (WCAG 4.1.2): Milkdown gives it `role="textbox"` only.
      // `setReadonly` updates the view, so the attributes follow the view mode.
      .config((ctx) =>
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          attributes: () => ({
            "aria-label": ariaLabelRef.current,
            ...(crepe.readonly ? { "aria-readonly": "true" } : {}),
          }),
        })),
      )
      .config((ctx) => configFormattingShortcuts(ctx, isMac))
      .config((ctx) => registerFootnoteDecorations(ctx))
      .config((ctx) => registerFootnoteInteraction(ctx))
      .config((ctx) => registerFindDecorations(ctx))
      .config((ctx) => keepImageBlockAlt(ctx))
      .use(remarkFrontmatterPlugin)
      .use(frontmatterSchema)
      .use(linkInputRule)
      .use(footnoteInputRule)
      .use(footnoteCompletionPlugin)
      .use(autoPairingPlugin)
      .use(taskListToggle)
      .use(
        imageBlockAltText({
          label: t("imageBlock.altLabel"),
          placeholder: t("imageBlock.altPlaceholder"),
        }),
      );
    if (!isMac) crepe.editor.use(linkShortcutKeymap).use(footnoteKeymap);
    // Crepe always installs `@milkdown/plugin-indent`, whose Tab inserts spaces at
    // any caret: Tab could never leave the editor (WCAG 2.1.2) and silently wrote
    // spaces into headings and paragraphs. Without it, Tab still sinks/lifts list
    // items (commonmark list keymap), moves between table cells and indents inside
    // code blocks (CodeMirror); anywhere else it moves focus out of the editor.
    // Removing a plugin before `create()` drops it from the store synchronously;
    // its config slice stays, because Crepe's own config still updates it.
    void crepe.editor.remove(indentPlugin);
    // Write back what the user did not edit as it was (`<br>` lines, `-` bullets).
    configureMarkdownFidelity(crepe);

    crepe.on((listener) => {
      // Normalized baseline once mounted; expose the instance to imperative features.
      listener.mounted(() => {
        // Unmounted before creation finished: this instance is being destroyed
        // and must never be exposed to imperative features.
        if (disposedRef.current.has(crepe)) return;
        // `mounted` claims the active-editor slot (so Find/Format work before the
        // first focus); the `listener.focus` handler below re-claims it on focus.
        setActiveEditor(crepe);
        // Register in the by-doc registry so the file watcher can target this
        // instance by document id.
        registerEditor(docIdRef.current, crepe);
        crepe.setReadonly(useUi.getState().viewMode === "reading");
        onReadyRef.current?.(crepe.getMarkdown());
      });
      // Live edits (debounced internally by the listener plugin).
      listener.markdownUpdated((_ctx, markdown, prevMarkdown) => {
        if (markdown !== prevMarkdown) onChangeRef.current(markdown);
      });
      // Flush on blur so the store is current before tab switch / save, then let
      // auto-save persist immediately (no-op while auto-save is off).
      listener.blur(() => {
        onChangeRef.current(crepe.getMarkdown());
        onBlurRef.current?.();
      });
      // Take over the active-editor slot when this editor is focused, so
      // imperative features target the instance the user is actually in.
      // `listener.focus` is provided by @milkdown/plugin-listener 7.23.0.
      listener.focus(() => {
        setActiveEditor(crepe);
        // Find must also follow focus: make this editor's controller current so the
        // Find panel drives the WYSIWYG view the user is actually in. No-op in
        // source mode — SourceEditor owns the controller while it's mounted and
        // this WYSIWYG view is hidden (it cannot receive focus then).
        if (useUi.getState().viewMode !== "source") {
          setSearchController(searchControllerRef.current);
        }
      });
      // Report the selected text so the status bar can show per-selection
      // word/character counts.
      listener.selectionUpdated(reportSelection);
    });

    return crepe;
  }, []);

  // Reading view makes the editor read-only; edit/source keep it editable.
  // Acts on ITS OWN editor (crepeRef), not the global active slot, so every
  // live instance follows the view change.
  useEffect(() => {
    crepeRef.current?.setReadonly(viewMode === "reading");
  }, [viewMode]);

  // A renamed document renames its editor: re-run the view's attributes.
  useEffect(() => {
    const crepe = crepeRef.current;
    if (crepe?.editor.status !== EditorStatus.Created) return;
    crepe.editor.action((ctx) => viewFromCtx(ctx).setProps({}));
  }, [ariaLabel]);

  // Own the Find controller whenever this WYSIWYG view is the visible editor.
  // Crepe stays mounted (just hidden) in source mode, so reclaim the controller
  // when leaving source — SourceEditor installs its own while it's mounted.
  useEffect(() => {
    if (viewMode !== "source") {
      setSearchController(searchControllerRef.current);
      refreshActiveSearch();
    }
  }, [viewMode]);

  // Release the active-editor slot, the by-doc registry entry and the search
  // controller (each only if this instance still owns it) and clear any
  // reported selection when this editor unmounts. Other instances keep theirs.
  useEffect(
    () => () => {
      if (crepeRef.current) {
        disposedRef.current.add(crepeRef.current);
        clearActiveEditorIf(crepeRef.current);
        unregisterEditor(docIdRef.current, crepeRef.current);
      }
      if (searchControllerRef.current) clearSearchControllerIf(searchControllerRef.current);
      releaseControlLabelsRef.current?.();
      releaseControlLabelsRef.current = null;
      useSelection.getState().clear();
    },
    [],
  );

  return <Milkdown />;
}

/** WYSIWYG markdown editor backed by Milkdown Crepe. */
export function CrepeEditor(props: CrepeEditorProps) {
  return (
    <MilkdownProvider>
      <MilkdownEditor {...props} />
    </MilkdownProvider>
  );
}
