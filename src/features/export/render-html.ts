import i18n from "@/i18n";

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char,
  );
}

/** Wrap rendered content into a standalone HTML document with inlined styles + fonts. */
export function wrapStandaloneHtml(
  contentHtml: string,
  title: string,
  css: string,
  fontFaces = "",
): string {
  return `<!doctype html>
<html lang="${escapeHtml(i18n.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${fontFaces}${css}</style>
</head>
<body><main>${contentHtml}</main></body>
</html>`;
}
