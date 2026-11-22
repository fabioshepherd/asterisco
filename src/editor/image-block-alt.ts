import { IMAGE_DATA_TYPE, imageBlockSchema } from "@milkdown/kit/component/image-block";
import { EditorStateReady, editorViewTimerCtx, nodeViewCtx } from "@milkdown/kit/core";
import type { Ctx, MilkdownPlugin } from "@milkdown/kit/ctx";
import { expectDomTypeError } from "@milkdown/kit/exception";
import type { Node as ProseNode } from "@milkdown/kit/prose/model";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";
import type { NodeSchema } from "@milkdown/kit/transformer";
import { addTimer } from "@milkdown/kit/utils";

/**
 * The image-block node attributes we read. ProseMirror types `node.attrs` as
 * `{ readonly [attr: string]: any }`, so it is narrowed once at this boundary.
 */
interface ImageBlockAttrs {
  src: string;
  caption: string;
  alt: string;
}

/**
 * Make Crepe's image block round-trip `alt` and `title` verbatim.
 *
 * Upstream (`@milkdown/components` image-block) turns a paragraph holding only
 * an image into an image block and stores its resize ratio in `alt`, so
 * `![Architecture](a.png)` is saved as `![1.00](a.png)`. Resizing is not offered
 * (the handle is hidden in `editor-theme.css`), so the ratio stays at its default
 * and `alt` is kept in its own attribute instead. `title` maps to the caption.
 *
 * Mechanism: a ctx update on the schema-spec factory slice (`imageBlockSchema.key`)
 * before the schema is built, so the node id and Crepe's caption/upload node view
 * stay intact (call inside `.config`).
 */
export function keepImageBlockAlt(ctx: Ctx): void {
  ctx.update(imageBlockSchema.key, (prev) => (innerCtx) => {
    const base = prev(innerCtx);
    const extended: NodeSchema = {
      ...base,
      attrs: {
        ...base.attrs,
        alt: { default: "", validate: "string" },
      },
      parseDOM: [
        {
          tag: `img[data-type="${IMAGE_DATA_TYPE}"]`,
          getAttrs: (dom) => {
            if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom);
            return {
              src: dom.getAttribute("src") ?? "",
              caption: dom.getAttribute("caption") ?? "",
              alt: dom.getAttribute("alt") ?? "",
            };
          },
        },
      ],
      parseMarkdown: {
        match: ({ type }) => type === "image-block",
        runner: (state, node, type) => {
          state.addNode(type, {
            src: node.url as string,
            caption: (node.title as string | null | undefined) ?? "",
            alt: (node.alt as string | null | undefined) ?? "",
          });
        },
      },
      toMarkdown: {
        match: (node: ProseNode) => node.type.name === "image-block",
        runner: (state, node) => {
          const attrs = node.attrs as ImageBlockAttrs;
          state.openNode("paragraph");
          state.addNode("image", undefined, undefined, {
            title: attrs.caption,
            url: attrs.src,
            alt: attrs.alt,
          });
          state.closeNode();
        },
      },
    };
    return extended;
  });
}

/** Localized strings for the image block's "Alt text" field. */
export interface ImageAltLabels {
  /** Visible field label, e.g. "Alt text". */
  label: string;
  /** Input placeholder describing what to write. */
  placeholder: string;
}

/**
 * Wrap Crepe's image-block node view so the rendered `<img>` carries the
 * Markdown alt text (`attrs.alt`) instead of the caption, and add an "Alt text"
 * field that edits it (WCAG 1.1.1). Upstream renders `alt` from the caption, so
 * `![Architecture](a.png "The system")` was announced as "The system" and an
 * image without a title became decorative (`alt=""`).
 *
 * The upstream view is a Vue app that re-patches `alt` whenever the caption
 * changes, so a MutationObserver puts the Markdown alt back after each patch.
 * The field is a plain input appended after the Vue-managed content: Crepe's
 * `stopEvent` already hands input events to the input, not ProseMirror.
 */
function withAltText(create: NodeViewConstructor, labels: ImageAltLabels): NodeViewConstructor {
  return (node, view, getPos, decorations, innerDecorations) => {
    const inner = create(node, view, getPos, decorations, innerDecorations);
    const dom = inner.dom;
    if (!(dom instanceof HTMLElement)) return inner;
    let alt = (node.attrs as ImageBlockAttrs).alt;

    const syncImage = () => {
      const img = dom.querySelector(`img[data-type="${IMAGE_DATA_TYPE}"]`);
      if (img && img.getAttribute("alt") !== alt) img.setAttribute("alt", alt);
    };
    const observer = new MutationObserver(syncImage);
    observer.observe(dom, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["alt"],
    });

    const field = document.createElement("label");
    field.className = "image-alt-field";
    const text = document.createElement("span");
    text.textContent = labels.label;
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = labels.placeholder;
    // Same as Crepe's caption input: a draggable input inside the draggable
    // block lets the text be selected instead of starting a block drag.
    input.draggable = true;
    input.addEventListener("dragstart", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    field.append(text, input);
    dom.appendChild(field);

    const syncField = () => {
      input.disabled = !view.editable;
      if (document.activeElement !== input) input.value = alt;
    };
    const commit = () => {
      if (!view.editable || input.value === alt) return;
      const pos = getPos();
      if (pos == null) return;
      view.dispatch(view.state.tr.setNodeAttribute(pos, "alt", input.value));
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commit();
        view.focus();
      } else if (event.key === "Escape") {
        event.preventDefault();
        input.value = alt;
        view.focus();
      }
    });

    syncImage();
    syncField();

    return {
      ...inner,
      update: (updated, nextDecorations, nextInner) => {
        if (!inner.update?.(updated, nextDecorations, nextInner)) return false;
        alt = (updated.attrs as ImageBlockAttrs).alt;
        syncImage();
        syncField();
        return true;
      },
      destroy: () => {
        observer.disconnect();
        inner.destroy?.();
      },
    };
  };
}

/**
 * Render and edit image-block alt text (see `withAltText`). Replaces Crepe's
 * image-block node view entry before the editor view is built: the plugin is a
 * timer the view waits for, and it runs after `EditorStateReady`, by which time
 * every `$view` plugin has registered its node view.
 */
export function imageBlockAltText(labels: ImageAltLabels): MilkdownPlugin {
  return addTimer(
    async (ctx) => {
      await ctx.wait(EditorStateReady);
      ctx.update(nodeViewCtx, (views) =>
        views.map(([id, create]) =>
          id === imageBlockSchema.node.id ? [id, withAltText(create, labels)] : [id, create],
        ),
      );
    },
    editorViewTimerCtx,
    "ImageBlockAltText",
  );
}
