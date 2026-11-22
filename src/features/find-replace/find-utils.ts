export interface FindOptions {
  regex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a global RegExp for the query/options, or null when invalid/empty. */
function buildSearchRegExp(query: string, options: FindOptions): RegExp | null {
  if (!query) return null;
  let pattern = options.regex ? query : escapeRegExp(query);
  if (options.wholeWord) pattern = `\\b(?:${pattern})\\b`;
  try {
    return new RegExp(pattern, options.caseSensitive ? "g" : "gi");
  } catch {
    return null;
  }
}

/**
 * True when regex mode is on and the (non-empty) query fails to compile. Empty
 * queries and plain/whole-word searches are never invalid — only a genuine
 * regex syntax error counts, so the panel can tell "no syntax" from "no match".
 */
export function isInvalidRegex(query: string, options: FindOptions): boolean {
  if (!options.regex || query === "") return false;
  return buildSearchRegExp(query, options) === null;
}

/** A single match: its start offset and length within the searched text. */
export interface FindMatch {
  index: number;
  length: number;
}

/** Locate every non-overlapping match of the query in the text. */
export function findMatches(text: string, query: string, options: FindOptions): FindMatch[] {
  const regExp = buildSearchRegExp(query, options);
  if (!regExp) return [];

  const matches: FindMatch[] = [];
  let match: RegExpExecArray | null;
  while ((match = regExp.exec(text)) !== null) {
    matches.push({ index: match.index, length: match[0].length });
    // A zero-length match (e.g. `a*` against "bbb") would never advance
    // `lastIndex`, so step over it manually to avoid an infinite loop.
    if (match[0] === "") regExp.lastIndex += 1;
  }
  return matches;
}

/** Count non-overlapping matches of the query in the text. */
export function countMatches(text: string, query: string, options: FindOptions): number {
  return findMatches(text, query, options).length;
}

/** Replace every match with the replacement, returning the new text. */
export function replaceAllMatches(
  text: string,
  query: string,
  replacement: string,
  options: FindOptions,
): string {
  const regExp = buildSearchRegExp(query, options);
  if (!regExp) return text;
  // In literal mode, `$` in the replacement must not be treated as a group ref.
  const safeReplacement = options.regex ? replacement : replacement.replace(/\$/g, "$$$$");
  return text.replace(regExp, safeReplacement);
}
