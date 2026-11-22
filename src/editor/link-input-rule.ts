import { linkSchema } from "@milkdown/kit/preset/commonmark";
import { InputRule } from "@milkdown/kit/prose/inputrules";
import { $inputRule } from "@milkdown/kit/utils";

/** `[text](url)` ending at the caret; shared with auto-pairing's type-over completion. */
export const LINK_MARKDOWN_RE = /\[([^\]]+)\]\(([^\s)]+)\)$/;

/**
 * Inline link input rule: typing `[text](url)` becomes a real link the moment
 * the closing paren is entered. Crepe ships link editing via its selection
 * tooltip but no typed-Markdown shortcut, so `[text](url)` would otherwise sit
 * as literal text — breaking the "type Markdown, see it render" promise. Mirrors
 * Typora's behaviour. The link mark round-trips as standard Markdown.
 */
export const linkInputRule = $inputRule(
  (ctx) =>
    new InputRule(LINK_MARKDOWN_RE, (state, match, start, end) => {
      const [, text, href] = match;
      if (!text || !href) return null;
      const markType = linkSchema.type(ctx);
      return state.tr
        .replaceWith(start, end, state.schema.text(text, [markType.create({ href })]))
        .removeStoredMark(markType);
    }),
);
