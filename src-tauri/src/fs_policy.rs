//! One policy for what belongs to a documentation workspace.
//!
//! The file tree, quick-open and workspace search used to each carry their own
//! answer to "which files does this app open?" and "which folders do we walk
//! into?". They disagreed, so a file the open dialog accepted could be missing
//! from the tree, and a folder the tree showed could be unsearchable. Both
//! questions are answered here, once, and the TypeScript side mirrors this
//! module (see `src/features/file-tree/tree-utils.ts`); `extensions_match_the_frontend`
//! pins the two lists together.

use std::path::Path;
use std::sync::Arc;

use ignore::gitignore::{Gitignore, GitignoreBuilder};

/// Extensions the app opens as documents. Keep in sync with
/// `MARKDOWN_EXTENSIONS` in `src/features/file-tree/tree-utils.ts`.
pub const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "mdx", "txt"];

/// Folders whose contents are generated, vendored, or version-control state —
/// never documentation someone wrote. A developer's workspace is a repository,
/// so without this list the tree offers `node_modules` as a peer of `docs`.
///
/// The axis is *ignored*, not *hidden*: `.github`, `.claude` and `.cursor` are
/// dot-prefixed and are exactly where this product's users keep the agent files
/// PRODUCT.md puts in scope, so they stay visible. `.git` and friends are noise
/// whether or not they start with a dot.
const IGNORED_DIRS: &[&str] = &[
    // Dependencies and vendored code
    "node_modules",
    "bower_components",
    "vendor",
    ".yarn",
    ".pnpm-store",
    // Build output and caches
    "target",
    "dist",
    "build",
    "out",
    "coverage",
    "__pycache__",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".output",
    ".turbo",
    ".parcel-cache",
    ".cache",
    ".gradle",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    // Version control, environments and generated tool state
    ".git",
    ".hg",
    ".svn",
    ".worktrees",
    ".venv",
    "venv",
    ".terraform",
    ".idea",
];

/// Folders no ignore rule may hide.
///
/// These hold the agent files PRODUCT.md puts in scope, and they are the reason
/// this product exists. Plenty of repositories keep `.claude/` out of git —
/// local settings, scratch prompts — and a `.gitignore` line is not a statement
/// that the developer never wants to *read* those files. The built-in list
/// already exempts them; git's does too.
const ALWAYS_VISIBLE_DIRS: &[&str] = &[".github", ".claude", ".cursor"];

/// Whether a directory name is one this product refuses to hide.
pub fn is_always_visible_dir(name: &str) -> bool {
    ALWAYS_VISIBLE_DIRS.contains(&name)
}

/// The `.gitignore` files in effect for a directory, outermost first.
///
/// Git resolves a path against the *nearest* file first and works outwards, so
/// this is read in reverse — which is what makes a `!negation` in a nested
/// `.gitignore` beat an ignore rule at the root.
pub type IgnoreStack = Vec<Arc<Gitignore>>;

/// The matcher for `dir`'s own ignore files, or `None` when it has none.
///
/// At the workspace root that also means `.git/info/exclude`: git treats it as
/// a per-checkout ignore list, and the point of reading git's answer at all is
/// to give the same one git gives. The global `core.excludesFile` is left out —
/// it belongs to the user's shell habits, not to this repository.
fn gitignore_for(dir: &Path, is_root: bool) -> Option<Arc<Gitignore>> {
    let own = dir.join(".gitignore");
    let exclude = dir.join(".git").join("info").join("exclude");
    let has_own = own.is_file();
    let has_exclude = is_root && exclude.is_file();
    if !has_own && !has_exclude {
        return None;
    }
    let mut builder = GitignoreBuilder::new(dir);
    // Partial errors are returned, not raised: one unparsable glob must not
    // throw away the rest of a valid file.
    if has_own {
        builder.add(&own);
    }
    if has_exclude {
        builder.add(&exclude);
    }
    builder.build().ok().map(Arc::new)
}

/// Add `dir`'s ignore file to `stack`, reporting whether anything was pushed so
/// a recursive walk knows whether to pop on the way back up.
pub fn push_gitignore(stack: &mut IgnoreStack, dir: &Path, is_root: bool) -> bool {
    match gitignore_for(dir, is_root) {
        Some(matcher) => {
            stack.push(matcher);
            true
        }
        None => false,
    }
}

/// The stack in effect for `dir`, built from `root` downwards.
///
/// Used by the one-directory-at-a-time path (`read_dir`, for the tree), which
/// has no walk to carry the stack along.
///
/// It is rebuilt on every expansion, which looks like something to cache until
/// it is measured: 0.72–0.79 ms per call in release on this repository (root
/// `.gitignore`, 69 lines, plus two nested files), flat from depth 0 to depth 3
/// because the cost is compiling the root's globs, not walking up. Against one
/// user click, and against the `read_dir` syscalls that follow it, that is not
/// worth a cache whose invalidation would have to notice the user editing a
/// `.gitignore` — the one thing that would make the panel disagree with git.
pub fn ignore_stack(root: &Path, dir: &Path) -> IgnoreStack {
    let mut chain: Vec<&Path> = Vec::new();
    if dir.starts_with(root) {
        let mut current = Some(dir);
        while let Some(step) = current {
            chain.push(step);
            if step == root {
                break;
            }
            current = step.parent();
        }
        chain.reverse();
    } else {
        // Outside the workspace: the only file that can speak for it is its own.
        chain.push(dir);
    }
    let mut stack = IgnoreStack::new();
    for step in chain {
        push_gitignore(&mut stack, step, step == root);
    }
    stack
}

/// Whether git would ignore `path`, given the files in effect for its folder.
///
/// Nearest file wins, and a whitelist there stops the search — the same order
/// git uses, so `git status` and this panel cannot disagree.
pub fn git_ignores(stack: &[Arc<Gitignore>], path: &Path, is_dir: bool) -> bool {
    for matcher in stack.iter().rev() {
        let verdict = matcher.matched(path, is_dir);
        if verdict.is_whitelist() {
            return false;
        }
        if verdict.is_ignore() {
            return true;
        }
    }
    false
}

/// Whether a file name is a document this app opens.
pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .is_some_and(|ext| MARKDOWN_EXTENSIONS.contains(&ext.as_str()))
}

/// Whether a directory name is generated/vendored noise rather than content.
/// Case-insensitive, because macOS and Windows filesystems usually are.
pub fn is_ignored_dir(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    IGNORED_DIRS.contains(&lower.as_str())
}

/// Whether an entry is noise rather than content — the one answer, by both
/// rules, for the tree, quick-open and search alike.
///
/// `exempt` is set once a walk is already inside an always-visible folder, so
/// the carve-out covers a whole `.claude/` subtree and not only its top row.
/// The user's `show_ignored` setting is applied by the caller: this says what
/// is noise, not whether to show it.
pub fn is_ignored_entry(
    name: &str,
    path: &Path,
    is_dir: bool,
    stack: &[Arc<Gitignore>],
    exempt: bool,
) -> bool {
    if exempt || (is_dir && is_always_visible_dir(name)) {
        return false;
    }
    if is_dir && is_ignored_dir(name) {
        return true;
    }
    git_ignores(stack, path, is_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn accepts_every_document_extension() {
        for ext in MARKDOWN_EXTENSIONS {
            assert!(is_markdown(Path::new(&format!("README.{ext}"))), "{ext}");
        }
        assert!(is_markdown(Path::new("README.MD")), "case-insensitive");
        assert!(!is_markdown(Path::new("main.rs")));
        assert!(!is_markdown(Path::new("README")));
    }

    #[test]
    fn ignores_generated_folders_but_keeps_agent_folders() {
        assert!(is_ignored_dir("node_modules"));
        assert!(is_ignored_dir("target"));
        assert!(is_ignored_dir(".git"));
        assert!(is_ignored_dir("Node_Modules"), "case-insensitive");
        // The reason this product exists: agent files live in dot-folders.
        assert!(!is_ignored_dir(".github"));
        assert!(!is_ignored_dir(".claude"));
        assert!(!is_ignored_dir(".cursor"));
        assert!(!is_ignored_dir("docs"));
    }

    fn temp_repo(tag: &str) -> PathBuf {
        let root =
            std::env::temp_dir().join(format!("asterisco_policy_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    /// `is_ignored_entry` says what is noise; the caller decides whether to show
    /// it. Keeping those two apart is what lets one setting reveal everything.
    #[test]
    fn the_built_in_list_still_applies_without_any_gitignore() {
        let root = temp_repo("builtin");
        let stack = ignore_stack(&root, &root);

        assert!(is_ignored_entry(
            "node_modules",
            &root.join("node_modules"),
            true,
            &stack,
            false
        ));
        assert!(!is_ignored_entry(
            "docs",
            &root.join("docs"),
            true,
            &stack,
            false
        ));
        assert!(!is_ignored_entry(
            "a.md",
            &root.join("a.md"),
            false,
            &stack,
            false
        ));

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn reads_the_repository_gitignore_including_negations_and_nesting() {
        let root = temp_repo("gitignore");
        let docs = root.join("docs");
        std::fs::create_dir_all(&docs).unwrap();
        std::fs::write(
            root.join(".gitignore"),
            "generated/\n*.draft.md\n!keep.draft.md\n",
        )
        .unwrap();
        // A nested file speaks for its own folder and outranks the one above it.
        std::fs::write(docs.join(".gitignore"), "!*.draft.md\n").unwrap();

        let at_root = ignore_stack(&root, &root);
        assert!(is_ignored_entry(
            "generated",
            &root.join("generated"),
            true,
            &at_root,
            false
        ));
        assert!(is_ignored_entry(
            "notes.draft.md",
            &root.join("notes.draft.md"),
            false,
            &at_root,
            false
        ));
        assert!(!is_ignored_entry(
            "keep.draft.md",
            &root.join("keep.draft.md"),
            false,
            &at_root,
            false
        ));

        let in_docs = ignore_stack(&root, &docs);
        assert!(!is_ignored_entry(
            "notes.draft.md",
            &docs.join("notes.draft.md"),
            false,
            &in_docs,
            false
        ));

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn honors_git_info_exclude_at_the_root_only() {
        let root = temp_repo("exclude");
        std::fs::create_dir_all(root.join(".git").join("info")).unwrap();
        std::fs::write(root.join(".git").join("info").join("exclude"), "scratch/\n").unwrap();

        let stack = ignore_stack(&root, &root);
        assert!(is_ignored_entry(
            "scratch",
            &root.join("scratch"),
            true,
            &stack,
            false
        ));

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// The reason this product exists. Plenty of repositories keep `.claude/`
    /// out of git; that is not a statement that the developer never wants to
    /// read the files in it.
    #[test]
    fn a_gitignore_cannot_hide_the_agent_folders() {
        let root = temp_repo("agents");
        let claude = root.join(".claude");
        std::fs::create_dir_all(&claude).unwrap();
        std::fs::write(root.join(".gitignore"), ".claude/\n.github/\n").unwrap();

        let stack = ignore_stack(&root, &root);
        assert!(!is_ignored_entry(".claude", &claude, true, &stack, false));
        assert!(!is_ignored_entry(
            ".github",
            &root.join(".github"),
            true,
            &stack,
            false
        ));
        // And the carve-out covers the subtree, not just its top row.
        let inside = ignore_stack(&root, &claude);
        assert!(!is_ignored_entry(
            "skills",
            &claude.join("skills"),
            true,
            &inside,
            true
        ));

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// The frontend keeps its own copy of the extension list (it filters the
    /// tree client-side). Drift between the two is what made the open dialog
    /// accept files the tree could not show, so pin them together.
    #[test]
    fn extensions_match_the_frontend() {
        let source = include_str!("../../src/features/file-tree/tree-utils.ts");
        let line = source
            .lines()
            .find(|line| line.contains("export const MARKDOWN_EXTENSIONS"))
            .expect("MARKDOWN_EXTENSIONS not found in tree-utils.ts");
        for ext in MARKDOWN_EXTENSIONS {
            assert!(
                line.contains(&format!("\"{ext}\"")),
                "frontend list is missing {ext}: {line}"
            );
        }
        let frontend_count = line.matches('"').count() / 2;
        assert_eq!(
            frontend_count,
            MARKDOWN_EXTENSIONS.len(),
            "frontend list has extensions Rust does not: {line}"
        );
    }
}
