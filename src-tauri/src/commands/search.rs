use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::error::{AppError, AppResult};
use crate::fs_policy::{
    is_always_visible_dir, is_ignored_entry, is_markdown, push_gitignore, IgnoreStack,
};

/// Caps so a huge workspace can't stall the UI or exhaust memory.
const MAX_FILES: usize = 5000;
const MAX_MATCHES_PER_FILE: usize = 100;
const MAX_TOTAL_MATCHES: usize = 2000;
const MAX_FILE_BYTES: u64 = 2 * 1024 * 1024;
const MAX_PREVIEW_CHARS: usize = 240;

#[derive(Serialize)]
pub struct SearchMatch {
    /// 1-based line number.
    pub line: usize,
    /// 1-based column of the first match on the line.
    pub column: usize,
    /// Trimmed line text for preview.
    pub text: String,
}

#[derive(Serialize)]
pub struct SearchFileResult {
    /// Path relative to the workspace root (display label).
    pub name: String,
    /// Absolute path on disk.
    pub path: String,
    pub matches: Vec<SearchMatch>,
}

/// The results, plus whether they are all of them.
#[derive(Serialize)]
pub struct SearchResults {
    pub files: Vec<SearchFileResult>,
    /// A limit stopped the scan before the workspace ran out: one of the caps
    /// above, or a file skipped for being over `MAX_FILE_BYTES`. When this is
    /// set the counts are a floor, and the UI must not print them as the total.
    pub truncated: bool,
}

fn trim_preview(line: &str) -> String {
    let trimmed = line.trim();
    if trimmed.chars().count() > MAX_PREVIEW_CHARS {
        let mut out: String = trimmed.chars().take(MAX_PREVIEW_CHARS).collect();
        out.push('…');
        out
    } else {
        trimmed.to_string()
    }
}

/// Find matching lines in a single file's content.
///
/// Collects one match past `MAX_MATCHES_PER_FILE` so the caller can tell a file
/// with exactly 100 hits from one that was cut short.
fn search_content(content: &str, needle: &str, case_sensitive: bool) -> Vec<SearchMatch> {
    let mut matches = Vec::new();
    let needle_cmp = if case_sensitive {
        needle.to_string()
    } else {
        needle.to_lowercase()
    };

    for (i, line) in content.lines().enumerate() {
        let haystack = if case_sensitive {
            line.to_string()
        } else {
            line.to_lowercase()
        };
        if let Some(byte_idx) = haystack.find(&needle_cmp) {
            let column = haystack[..byte_idx].chars().count() + 1;
            matches.push(SearchMatch {
                line: i + 1,
                column,
                text: trim_preview(line),
            });
            if matches.len() > MAX_MATCHES_PER_FILE {
                break;
            }
        }
    }
    matches
}

/// What the walk is looking for — constant for the whole scan.
struct Query<'a> {
    root: &'a Path,
    needle: &'a str,
    case_sensitive: bool,
    show_ignored: bool,
}

/// What the walk has spent so far.
///
/// Every cap is accounted for exactly: `truncated` is set only where content
/// was actually dropped, so a workspace that lands precisely on a limit is
/// still reported as a complete result.
#[derive(Default)]
struct Budget {
    files_seen: usize,
    total_matches: usize,
    truncated: bool,
}

impl Budget {
    fn spent(&self) -> bool {
        self.files_seen >= MAX_FILES || self.total_matches >= MAX_TOTAL_MATCHES
    }
}

/// Same descent rule as the file tree and quick-open (`fs_policy`): what the
/// tree lists is what search can reach. `seen` breaks symlink cycles.
fn walk(
    dir: &Path,
    query: &Query,
    exempt: bool,
    ignores: &mut IgnoreStack,
    seen: &mut HashSet<PathBuf>,
    budget: &mut Budget,
    out: &mut Vec<SearchFileResult>,
) {
    if let Ok(real) = dir.canonicalize() {
        if !seen.insert(real) {
            return;
        }
    }
    let pushed = push_gitignore(ignores, dir, dir == query.root);
    walk_entries(dir, query, exempt, ignores, seen, budget, out);
    if pushed {
        ignores.pop();
    }
}

fn walk_entries(
    dir: &Path,
    query: &Query,
    exempt: bool,
    ignores: &mut IgnoreStack,
    seen: &mut HashSet<PathBuf>,
    budget: &mut Budget,
    out: &mut Vec<SearchFileResult>,
) {
    // A folder that cannot be opened is stepped over, as the tree and
    // quick-open do (`workspace::walk`): one locked subfolder used to fail the
    // whole search. Its documents were not searched, so the result is marked
    // incomplete rather than presented as the whole workspace.
    let Ok(entries) = std::fs::read_dir(dir) else {
        budget.truncated = true;
        return;
    };
    for entry in entries {
        // Checked before the entry rather than after it: reaching the limit on
        // the very last entry left nothing out, and saying otherwise would be
        // the same silent inaccuracy in the other direction.
        if budget.spent() {
            budget.truncated = true;
            break;
        }
        let Ok(entry) = entry else {
            budget.truncated = true;
            continue;
        };
        let name = entry.file_name().to_string_lossy().into_owned();
        let path = entry.path();
        let is_dir = path.is_dir();
        if !query.show_ignored && is_ignored_entry(&name, &path, is_dir, ignores, exempt) {
            continue;
        }
        if is_dir {
            walk(
                &path,
                query,
                exempt || is_always_visible_dir(&name),
                ignores,
                seen,
                budget,
                out,
            );
        } else if is_markdown(&path) {
            budget.files_seen += 1;
            let too_big = entry
                .metadata()
                .map(|m| m.len() > MAX_FILE_BYTES)
                .unwrap_or(true);
            if too_big {
                // A file we declined to read is a file we did not search.
                budget.truncated = true;
                continue;
            }
            if let Ok(content) = std::fs::read_to_string(&path) {
                let mut matches = search_content(&content, query.needle, query.case_sensitive);
                if matches.len() > MAX_MATCHES_PER_FILE {
                    matches.truncate(MAX_MATCHES_PER_FILE);
                    budget.truncated = true;
                }
                let room = MAX_TOTAL_MATCHES - budget.total_matches;
                if matches.len() > room {
                    matches.truncate(room);
                    budget.truncated = true;
                }
                if !matches.is_empty() {
                    budget.total_matches += matches.len();
                    let relative = path.strip_prefix(query.root).unwrap_or(&path);
                    out.push(SearchFileResult {
                        name: relative.to_string_lossy().into_owned(),
                        path: path.to_string_lossy().into_owned(),
                        matches,
                    });
                }
            }
        }
    }
}

/// Full-text search of all markdown files under `root` for `query` (substring,
/// case-insensitive by default). Returns per-file matching lines for preview/jump.
#[tauri::command(async)]
pub fn search_workspace(
    root: String,
    query: String,
    case_sensitive: bool,
    show_ignored: Option<bool>,
) -> AppResult<SearchResults> {
    let mut files = Vec::new();
    if query.is_empty() {
        return Ok(SearchResults {
            files,
            truncated: false,
        });
    }
    let root_path = PathBuf::from(&root);
    // Folders below the root are skipped when they cannot be opened; the root
    // itself is the whole search, so a deleted or unmounted workspace is an
    // error the UI names, not an empty, "incomplete" result.
    std::fs::read_dir(&root_path).map_err(|err| AppError::at(&root_path, err))?;
    let mut seen = HashSet::new();
    let mut budget = Budget::default();
    let mut ignores = IgnoreStack::new();
    walk(
        &root_path,
        &Query {
            root: &root_path,
            needle: &query,
            case_sensitive,
            show_ignored: show_ignored.unwrap_or(false),
        },
        false,
        &mut ignores,
        &mut seen,
        &mut budget,
        &mut files,
    );
    files.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(SearchResults {
        files,
        truncated: budget.truncated,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn searches_case_insensitively_by_default() {
        let matches = search_content("Hello World\nsecond line\nhello again", "hello", false);
        assert_eq!(matches.len(), 2);
        assert_eq!(matches[0].line, 1);
        assert_eq!(matches[0].column, 1);
        assert_eq!(matches[1].line, 3);
    }

    #[test]
    fn respects_case_sensitivity() {
        let matches = search_content("Hello\nhello", "hello", true);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].line, 2);
    }

    #[test]
    fn reports_the_column_of_the_first_match() {
        let matches = search_content("a needle here", "needle", false);
        assert_eq!(matches.len(), 1);
        assert_eq!(matches[0].column, 3);
    }

    #[test]
    fn walks_a_workspace_and_finds_matches() {
        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_search_{}", std::process::id()));
        let sub = root.join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(root.join("a.md"), "alpha needle\nbeta").unwrap();
        std::fs::write(sub.join("b.md"), "gamma\nNEEDLE delta").unwrap();
        std::fs::write(root.join("c.txt"), "needle in a text file").unwrap();
        std::fs::write(root.join("d.rs"), "needle in source").unwrap();

        let results = search_workspace(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            false,
            None,
        )
        .unwrap();

        // .md, .markdown, .mdx and .txt are documents; source files are not.
        assert_eq!(results.files.len(), 3);
        assert!(results.files.iter().all(|r| !r.matches.is_empty()));
        assert!(!results.files.iter().any(|r| r.name.ends_with(".rs")));
        assert!(!results.truncated, "nothing was left out");

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// The summary line prints these counts, so a capped scan that claims to be
    /// complete states a false number. The flag is what stops it.
    #[test]
    fn flags_a_scan_that_hit_the_per_file_cap() {
        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_search_cap_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();

        let exact = "needle\n".repeat(MAX_MATCHES_PER_FILE);
        std::fs::write(root.join("a.md"), &exact).unwrap();
        let results = search_workspace(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            false,
            None,
        )
        .unwrap();
        assert_eq!(results.files[0].matches.len(), MAX_MATCHES_PER_FILE);
        assert!(
            !results.truncated,
            "exactly MAX_MATCHES_PER_FILE hits is a complete answer"
        );

        std::fs::write(root.join("a.md"), format!("{exact}needle\n")).unwrap();
        let results = search_workspace(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            false,
            None,
        )
        .unwrap();
        assert_eq!(results.files[0].matches.len(), MAX_MATCHES_PER_FILE);
        assert!(results.truncated);

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// A file too large to read is a file that was not searched. Skipping it in
    /// silence is the same omission as tripping a cap in silence.
    #[test]
    fn flags_a_file_skipped_for_being_too_big() {
        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_search_big_{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        let filler = "x".repeat(1024);
        let mut huge = String::with_capacity(MAX_FILE_BYTES as usize + 2048);
        while huge.len() as u64 <= MAX_FILE_BYTES {
            huge.push_str(&filler);
            huge.push('\n');
        }
        huge.push_str("needle\n");
        std::fs::write(root.join("huge.md"), &huge).unwrap();

        let results = search_workspace(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            false,
            None,
        )
        .unwrap();
        assert!(results.files.is_empty());
        assert!(results.truncated, "the skip must be reported, not hidden");

        std::fs::remove_dir_all(&root).unwrap();
    }

    /// One locked folder used to turn the whole search into an error, while
    /// the tree and quick-open step over the same folder. The rest of the
    /// workspace is still searched, and the gap is reported, not hidden.
    #[cfg(unix)]
    #[test]
    fn an_unreadable_folder_is_skipped_not_fatal() {
        use std::os::unix::fs::PermissionsExt;

        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_search_locked_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let locked = root.join("locked");
        std::fs::create_dir_all(&locked).unwrap();
        std::fs::write(locked.join("hidden.md"), "needle").unwrap();
        std::fs::write(root.join("open.md"), "needle").unwrap();
        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o000)).unwrap();

        // Root ignores permission bits; the failure cannot be produced there.
        if std::fs::read_dir(&locked).is_err() {
            let results = search_workspace(
                root.to_string_lossy().into_owned(),
                "needle".into(),
                false,
                None,
            )
            .expect("a locked subfolder must not abort the search");
            let names: Vec<_> = results.files.iter().map(|r| r.name.clone()).collect();
            assert_eq!(names, vec!["open.md".to_string()]);
            assert!(results.truncated, "a folder not searched is a gap");
        }

        std::fs::set_permissions(&locked, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::remove_dir_all(&root).unwrap();
    }

    /// Skipping a locked *subfolder* is a partial answer; a workspace root that
    /// is gone (deleted, unmounted) is no answer at all. It must stay an error
    /// the UI can name, not "no matches in the part searched".
    #[test]
    fn a_missing_workspace_root_is_still_an_error() {
        let root = std::env::temp_dir().join("asterisco_search_no_such_root_ever");
        let _ = std::fs::remove_dir_all(&root);

        let error = search_workspace(
            root.to_string_lossy().into_owned(),
            "needle".into(),
            false,
            None,
        )
        .err()
        .expect("a missing root must not look like an empty search");
        let value = serde_json::to_value(error).unwrap();
        assert_eq!(value["kind"], "notFound");
        assert_eq!(value["path"], root.to_string_lossy().as_ref());
    }

    #[test]
    fn searches_agent_folders_and_skips_generated_ones() {
        let mut root = std::env::temp_dir();
        root.push(format!("asterisco_search_policy_{}", std::process::id()));
        let agents = root.join(".github");
        let deps = root.join("node_modules");
        std::fs::create_dir_all(&agents).unwrap();
        std::fs::create_dir_all(&deps).unwrap();
        std::fs::write(agents.join("SKILL.md"), "the needle").unwrap();
        std::fs::write(deps.join("README.md"), "the needle").unwrap();

        let found = |show_ignored: Option<bool>| {
            search_workspace(
                root.to_string_lossy().into_owned(),
                "needle".into(),
                false,
                show_ignored,
            )
            .unwrap()
            .files
            .iter()
            .map(|r| r.name.clone())
            .collect::<Vec<_>>()
        };

        // The old dot-prefix skip made agent files permanently unsearchable.
        let names = found(None);
        assert!(names.iter().any(|n| n.ends_with("SKILL.md")), "{names:?}");
        assert!(
            !names.iter().any(|n| n.contains("node_modules")),
            "{names:?}"
        );

        assert!(found(Some(true)).iter().any(|n| n.contains("node_modules")));

        std::fs::remove_dir_all(&root).unwrap();
    }
}
