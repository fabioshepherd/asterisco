use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::AppResult;
use crate::fs_policy::{
    is_always_visible_dir, is_ignored_entry, is_markdown, push_gitignore, IgnoreStack,
};

#[derive(Serialize)]
pub struct MarkdownFile {
    /// Path relative to the workspace root, used as the display label.
    pub name: String,
    /// Absolute path on disk.
    pub path: String,
}

/// The index, plus whether it is the whole workspace.
#[derive(Serialize)]
pub struct MarkdownIndex {
    pub files: Vec<MarkdownFile>,
    /// `MAX_FILES` stopped the walk, so `files` is a depth-first prefix of the
    /// workspace. It is sorted afterwards, which makes a truncated list look
    /// exactly like a complete one — hence this flag, which the UI must show.
    pub truncated: bool,
    /// Folders the walk could not open — locked, vanished mid-walk, or on a
    /// volume that went away. One of them used to abort the whole index.
    pub skipped: usize,
}

/// Safety cap so a huge tree can't stall the palette / exhaust memory.
const MAX_FILES: usize = 5000;

/// What one walk accumulates.
///
/// `seen` holds canonicalized directories, so a symlink cycle terminates;
/// `skipped` counts the folders that could not be opened, which used to be an
/// error that ended the whole walk.
#[derive(Default)]
struct Scan {
    files: Vec<MarkdownFile>,
    seen: HashSet<PathBuf>,
    skipped: usize,
}

/// Recursive descent shared with the tree's visibility rule (`fs_policy`).
///
/// `seen` holds canonicalized directories so a symlink cycle terminates: we do
/// follow symlinks, because a symlinked `docs/` is a folder the tree shows and
/// the user expects to search.
///
/// The cap is probed one file past `MAX_FILES` so the caller can tell "the
/// workspace has exactly 5000 documents" from "we stopped early". The extra
/// entry is dropped before the list is returned.
///
/// A folder that cannot be opened is counted and stepped over, never raised:
/// one `EACCES` four levels down used to abort the index for the entire
/// workspace, which took the sidebar filter and quick-open with it. The tree
/// has always degraded to a single row for exactly this condition; the walk
/// now degrades the same way, and `skipped` is what keeps that honest.
fn walk(
    dir: &Path,
    root: &Path,
    show_ignored: bool,
    exempt: bool,
    ignores: &mut IgnoreStack,
    scan: &mut Scan,
) {
    if scan.files.len() > MAX_FILES {
        return;
    }
    if let Ok(real) = dir.canonicalize() {
        if !scan.seen.insert(real) {
            return;
        }
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        scan.skipped += 1;
        return;
    };
    // A `.gitignore` here applies to this folder and everything under it, and
    // outranks the ones above — so it is pushed on the way down and popped on
    // the way back up.
    let pushed = push_gitignore(ignores, dir, dir == root);
    for entry in entries {
        let Ok(entry) = entry else {
            scan.skipped += 1;
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        let is_dir = path.is_dir();
        if !show_ignored && is_ignored_entry(&name, &path, is_dir, ignores, exempt) {
            continue;
        }
        if is_dir {
            walk(
                &path,
                root,
                show_ignored,
                exempt || is_always_visible_dir(&name),
                ignores,
                scan,
            );
        } else if is_markdown(&path) {
            let relative = path.strip_prefix(root).unwrap_or(&path);
            scan.files.push(MarkdownFile {
                name: relative.to_string_lossy().into_owned(),
                path: path.to_string_lossy().into_owned(),
            });
        }
        if scan.files.len() > MAX_FILES {
            break;
        }
    }
    if pushed {
        ignores.pop();
    }
}

/// Recursively list markdown files under `root` (relative names), for quick-open.
/// `show_ignored` mirrors the file tree's setting, so quick-open offers exactly
/// what the tree shows — including `.github` / `.claude` agent files, which the
/// old dot-prefix skip made permanently unreachable.
#[tauri::command(async)]
pub fn list_markdown_files(root: String, show_ignored: Option<bool>) -> AppResult<MarkdownIndex> {
    let root_path = PathBuf::from(&root);
    let mut ignores = IgnoreStack::new();
    let mut scan = Scan::default();
    walk(
        &root_path,
        &root_path,
        show_ignored.unwrap_or(false),
        false,
        &mut ignores,
        &mut scan,
    );
    let Scan {
        mut files, skipped, ..
    } = scan;
    let truncated = files.len() > MAX_FILES;
    files.truncate(MAX_FILES);
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(MarkdownIndex {
        files,
        truncated,
        skipped,
    })
}

/// Files that mark the root of a project.
const PROJECT_MARKERS: &[&str] = &[
    ".git",
    "Cargo.toml",
    "go.mod",
    "pyproject.toml",
    "package.json",
    "deno.json",
];

/// Find the project a file belongs to, walking up from it.
///
/// The app is usually reached *from the file* (PRODUCT.md): a double click, an
/// "Open with", a path on argv. Without this the canonical launch opens a tab
/// against an empty sidebar.
///
/// Returns the *nearest* ancestor carrying a project marker, falling back to
/// the file's own folder — which is still a truthful body of files to browse.
/// Nearest rather than outermost on purpose: in a monorepo it scopes to the
/// package you opened instead of the whole tree, and a developer whose home
/// directory is a dotfiles repo doesn't get their entire home as a workspace.
/// Opening a wider folder stays one "Open folder" away, and now persists.
#[tauri::command]
pub fn find_project_root(path: String) -> AppResult<Option<String>> {
    let start = PathBuf::from(&path);
    let start = if start.is_dir() {
        start.clone()
    } else {
        match start.parent() {
            Some(parent) => parent.to_path_buf(),
            None => return Ok(None),
        }
    };

    let mut current = Some(start.as_path());
    while let Some(dir) = current {
        if PROJECT_MARKERS
            .iter()
            .any(|marker| dir.join(marker).exists())
        {
            return Ok(Some(dir.to_string_lossy().into_owned()));
        }
        current = dir.parent();
    }

    if start.is_dir() {
        Ok(Some(start.to_string_lossy().into_owned()))
    } else {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(tag: &str) -> PathBuf {
        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_ws_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        root
    }

    fn names_under(root: &Path, show_ignored: bool) -> Vec<String> {
        list_markdown_files(root.to_string_lossy().into_owned(), Some(show_ignored))
            .unwrap()
            .files
            .iter()
            .map(|file| file.name.clone())
            .collect()
    }

    #[test]
    fn lists_markdown_files_recursively() {
        let root = temp_root("list");
        let sub = root.join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(root.join("a.md"), "a").unwrap();
        std::fs::write(root.join("notes.txt"), "x").unwrap();
        std::fs::write(root.join("main.rs"), "x").unwrap();
        std::fs::write(sub.join("b.markdown"), "b").unwrap();

        let names = names_under(&root, false);

        assert!(names.contains(&"a.md".to_string()));
        assert!(names.iter().any(|n| n.ends_with("b.markdown")));
        // .txt is in scope per PRODUCT.md, and the open dialog already accepted it.
        assert!(names.contains(&"notes.txt".to_string()));
        assert!(!names.iter().any(|n| n.contains("main.rs")));

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn indexes_agent_folders_and_skips_generated_ones() {
        let root = temp_root("agents");
        let agents = root.join(".github");
        let deps = root.join("node_modules").join("pkg");
        std::fs::create_dir_all(&agents).unwrap();
        std::fs::create_dir_all(&deps).unwrap();
        std::fs::write(agents.join("SKILL.md"), "s").unwrap();
        std::fs::write(deps.join("README.md"), "r").unwrap();

        let names = names_under(&root, false);
        assert!(
            names.iter().any(|n| n.ends_with("SKILL.md")),
            "agent files must be reachable: {names:?}"
        );
        assert!(
            !names.iter().any(|n| n.contains("node_modules")),
            "dependencies must not be indexed: {names:?}"
        );

        // The setting opts back in, so the tree and quick-open never disagree.
        let all = names_under(&root, true);
        assert!(all.iter().any(|n| n.contains("node_modules")));

        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn the_index_obeys_the_repository_gitignore() {
        let root = temp_root("gitignore");
        let generated = root.join("generated");
        let claude = root.join(".claude");
        std::fs::create_dir_all(&generated).unwrap();
        std::fs::create_dir_all(&claude).unwrap();
        std::fs::write(
            root.join(".gitignore"),
            "generated/\nSCRATCH.md\n.claude/\n",
        )
        .unwrap();
        std::fs::write(root.join("README.md"), "r").unwrap();
        std::fs::write(root.join("SCRATCH.md"), "s").unwrap();
        std::fs::write(generated.join("api.md"), "a").unwrap();
        std::fs::write(claude.join("CLAUDE.md"), "c").unwrap();

        let names = names_under(&root, false);
        assert!(names.contains(&"README.md".to_string()), "{names:?}");
        assert!(!names.contains(&"SCRATCH.md".to_string()), "{names:?}");
        assert!(!names.iter().any(|n| n.contains("generated")), "{names:?}");
        // The agent folder is the reason this product exists; git's opinion of
        // it is not a reason to make it unreachable.
        assert!(names.iter().any(|n| n.ends_with("CLAUDE.md")), "{names:?}");

        // One setting still opens everything back up.
        let all = names_under(&root, true);
        assert!(all.contains(&"SCRATCH.md".to_string()), "{all:?}");
        assert!(all.iter().any(|n| n.contains("generated")), "{all:?}");

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// The list is sorted *after* the cap truncates it, so a prefix of a
    /// depth-first walk comes back looking like a complete A→Z index. The flag
    /// is the only thing standing between that and a false statement about the
    /// user's disk, so pin both the flag and the exact boundary.
    #[test]
    fn flags_a_truncated_index_and_only_when_it_truncates() {
        let root = temp_root("cap");
        std::fs::create_dir_all(&root).unwrap();
        for i in 0..MAX_FILES {
            std::fs::write(root.join(format!("doc{i:05}.md")), "x").unwrap();
        }

        let exact = list_markdown_files(root.to_string_lossy().into_owned(), None).unwrap();
        assert_eq!(exact.files.len(), MAX_FILES);
        assert!(
            !exact.truncated,
            "a workspace of exactly MAX_FILES documents is complete, not truncated"
        );

        std::fs::write(root.join("one-too-many.md"), "x").unwrap();
        let over = list_markdown_files(root.to_string_lossy().into_owned(), None).unwrap();
        assert_eq!(over.files.len(), MAX_FILES);
        assert!(over.truncated);

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// One locked folder used to abort the whole index with `?`, taking the
    /// sidebar filter and quick-open down with it — for a workspace that is
    /// otherwise entirely readable.
    #[cfg(unix)]
    #[test]
    fn one_unreadable_folder_costs_that_folder_and_nothing_else() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_root("locked");
        let locked = root.join("locked");
        let docs = root.join("docs");
        std::fs::create_dir_all(&locked).unwrap();
        std::fs::create_dir_all(&docs).unwrap();
        std::fs::write(root.join("README.md"), "r").unwrap();
        std::fs::write(docs.join("guide.md"), "g").unwrap();
        std::fs::write(locked.join("secret.md"), "s").unwrap();
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).unwrap();

        // Root reads a 0o000 folder regardless, so the failure this test needs
        // cannot be staged as root — every container that runs the suite as
        // root would see a red test about a defect that is not there.
        let locked_for_real = std::fs::read_dir(&locked).is_err();

        let index = list_markdown_files(root.to_string_lossy().into_owned(), None).unwrap();
        let names: Vec<_> = index.files.iter().map(|file| file.name.clone()).collect();

        assert!(names.contains(&"README.md".to_string()), "{names:?}");
        assert!(names.iter().any(|n| n.ends_with("guide.md")), "{names:?}");
        if locked_for_real {
            assert_eq!(index.skipped, 1, "the folder is counted, not swallowed");
        }

        // Root permissions have to come back or the cleanup fails.
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn finds_the_nearest_project_root_and_falls_back_to_the_folder() {
        let root = temp_root("root");
        let package = root.join("packages").join("api");
        std::fs::create_dir_all(&package).unwrap();
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::write(package.join("package.json"), "{}").unwrap();
        let doc = package.join("CLAUDE.md");
        std::fs::write(&doc, "d").unwrap();

        let found = find_project_root(doc.to_string_lossy().into_owned())
            .unwrap()
            .unwrap();
        assert_eq!(
            std::fs::canonicalize(&found).unwrap(),
            std::fs::canonicalize(&package).unwrap(),
            "nearest marker wins, so a monorepo scopes to the package"
        );

        // No marker anywhere: the file's own folder is still a body of files.
        let loose = temp_root("loose");
        std::fs::create_dir_all(&loose).unwrap();
        let orphan = loose.join("notes.md");
        std::fs::write(&orphan, "n").unwrap();
        let found = find_project_root(orphan.to_string_lossy().into_owned())
            .unwrap()
            .unwrap();
        assert_eq!(
            std::fs::canonicalize(&found).unwrap(),
            std::fs::canonicalize(&loose).unwrap()
        );

        std::fs::remove_dir_all(&root).unwrap();
        std::fs::remove_dir_all(&loose).unwrap();
    }
}
