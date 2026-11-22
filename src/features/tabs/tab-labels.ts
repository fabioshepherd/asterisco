/**
 * Tab labels that stay distinguishable.
 *
 * The files this app is for are, by construction, the ones whose names repeat:
 * every repository has a `README.md`, a `CHANGELOG.md`, a `CLAUDE.md`. A tab
 * strip that shows only the file name answers "which README is this?" with
 * silence, and the path in a tooltip is not an answer you can scan.
 *
 * So a name carries a folder suffix — the shortest one that tells it apart from
 * the other tabs sharing its name — and only when it has to. One unique
 * `notes.md` stays `notes.md`; two of them become `notes.md docs` and
 * `notes.md drafts`, widening to `api/v2` only if `docs` and `drafts` collided
 * too.
 *
 * Kept separate from `documentDisplayName`, which is the *file* name and is used
 * to build export filenames and rename drafts: those must never grow a folder.
 */

/** The part of a document this module needs: its identity and where it lives. */
export interface LabelledDoc {
  id: string;
  /** Absolute path on disk, or null for an unsaved (untitled) document. */
  path: string | null;
}

export interface TabLabel {
  /** File name, or the untitled label (numbered when several are open). */
  name: string;
  /** Shortest folder suffix that tells this tab apart, or null when unique. */
  context: string | null;
}

/** Path segments, separator-agnostic so Windows paths behave like POSIX ones. */
function segments(path: string): string[] {
  return path.split(/[/\\]/).filter(Boolean);
}

/**
 * Display labels for every open document, keyed by id.
 *
 * Callers render `name` as the tab title and `context`, when present, as a
 * quieter suffix beside it.
 */
export function tabLabels(
  docs: readonly LabelledDoc[],
  untitledLabel: string,
): Map<string, TabLabel> {
  const labels = new Map<string, TabLabel>();

  // Untitled documents have no path to disambiguate with, so they are numbered
  // in open order — and, like a folder suffix, the number only appears once
  // there is a second one to tell it apart from.
  const untitled = docs.filter((doc) => doc.path === null);
  untitled.forEach((doc, index) => {
    labels.set(doc.id, {
      name: untitled.length > 1 ? `${untitledLabel} ${index + 1}` : untitledLabel,
      context: null,
    });
  });

  const byName = new Map<string, { doc: LabelledDoc; folders: string[] }[]>();
  for (const doc of docs) {
    if (doc.path === null) continue;
    const parts = segments(doc.path);
    const name = parts.at(-1) ?? doc.path;
    const entry = { doc, folders: parts.slice(0, -1) };
    const group = byName.get(name);
    if (group) group.push(entry);
    else byName.set(name, [entry]);
  }

  for (const [name, group] of byName) {
    const first = group[0];
    if (group.length === 1 && first) {
      labels.set(first.doc.id, { name, context: null });
      continue;
    }
    // Widen the folder suffix a segment at a time until every tab in the group
    // reads differently. One segment nearly always does it; the full path is
    // the ceiling, and two documents on the exact same path never separate.
    const depth = Math.max(...group.map((entry) => entry.folders.length));
    let contexts = group.map(() => "");
    for (let width = 1; width <= depth; width++) {
      contexts = group.map((entry) => entry.folders.slice(-width).join("/"));
      if (new Set(contexts).size === group.length) break;
    }
    group.forEach((entry, index) => {
      labels.set(entry.doc.id, { name, context: contexts[index] || null });
    });
  }

  return labels;
}

/**
 * One label as a single string — `"README.md — docs/api"`. Used for accessible
 * names, where the visible name and its suffix have to arrive as one phrase.
 */
export function flattenLabel(label: TabLabel): string {
  return label.context ? `${label.name} — ${label.context}` : label.name;
}
