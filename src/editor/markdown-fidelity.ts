import type { Crepe } from "@milkdown/crepe";
import { remarkStringifyOptionsCtx } from "@milkdown/kit/core";
import { remarkPreserveEmptyLinePlugin } from "@milkdown/kit/preset/commonmark";

/**
 * Serializer settings so that what the user did not edit is written back as it
 * was ("survive a `git diff`", PRODUCT.md). Must run BEFORE `crepe.create()`:
 *
 * - Milkdown's commonmark preset turns empty paragraphs into literal `<br />`
 *   (its "preserve empty line" remark plugin). That surfaces as noise — a
 *   transient empty list item round-trips as `- <br />` — so the plugin goes.
 *   It has to go before the document is parsed: removed after `create()`, the
 *   parse had already turned typed `<br>` lines into empty paragraphs, which
 *   the next save then wrote as blank lines, deleting them from the file.
 *   Without it, a typed `<br>` stays an HTML node and is written verbatim, and
 *   an empty paragraph is a blank line.
 * - remark-stringify writes `*` bullets by default; `-` is what READMEs and
 *   changelogs use (and Keep a Changelog), so an edit no longer rewrites every
 *   list line. The marker is global: a `*`-bulleted file gets `-` once edited.
 *   Setext headings and `1)` ordered markers are not recorded per node, so they
 *   cannot be kept by options and are written as ATX / `1.`.
 */
export function configureMarkdownFidelity(crepe: Crepe): void {
  // Removing a plugin before `create()` drops it from the store synchronously.
  void crepe.editor.remove(remarkPreserveEmptyLinePlugin);
  crepe.editor.config((ctx) =>
    ctx.update(remarkStringifyOptionsCtx, (prev) => ({ ...prev, bullet: "-" as const })),
  );
}
