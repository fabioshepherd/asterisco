use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager, State};

use crate::commands::watcher::{SelfWriteState, WatcherState};
use crate::error::{AppError, AppResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    /// Noise rather than content by `fs_policy` — a generated/vendored folder,
    /// something the repository's `.gitignore` excludes, or a symlink that
    /// loops back on itself. Hidden by default, but reported so the client can
    /// tell "empty" from "nothing but build output" and can re-filter in memory
    /// when the setting flips.
    pub ignored: bool,
}

/// One folder, plus what it took to list it.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirListing {
    /// What is in the folder, up to the cap.
    pub entries: Vec<DirEntry>,
    /// Everything on disk here, cap or no cap — the number "empty folder" has
    /// to be measured against.
    pub total: usize,
    /// How many of `total` were examined. Anything below `total` means the
    /// listing stopped early and `entries` is a prefix of the folder.
    pub scanned: usize,
}

/// How many entries one expansion examines.
///
/// Measured (release, this machine): a 50,000-entry folder costs 416 ms to stat
/// and 6.9 MB of JSON to hand across IPC — before React mounts a row per entry.
/// 2,000 sits far above any hand-authored documentation folder and keeps one
/// expansion in the low tens of milliseconds. Entries past the cap are still
/// counted, so the panel can say how much of the folder it looked at instead of
/// presenting a prefix as the whole thing.
const MAX_DIR_ENTRIES: usize = 2000;

#[tauri::command(async)]
pub fn read_text_file(path: String) -> AppResult<String> {
    if !Path::new(&path).exists() {
        return Err(AppError::NotFound(path));
    }
    std::fs::read_to_string(&path).map_err(|err| AppError::at(&path, err))
}

/// Serial number for scratch files, so two saves racing in the same folder
/// cannot pick the same name.
static TEMP_SERIAL: AtomicU64 = AtomicU64::new(0);

/// Replace `path`'s contents without ever leaving a half-written file on disk.
///
/// `std::fs::write` truncates the original and then streams into it, so a
/// crash, a full disk or a power loss mid-write leaves the document truncated
/// or empty with the previous contents already gone. That is the one failure a
/// local-first editor must not have: the file is the product, and the app is
/// only the lens.
///
/// So the bytes go to a sibling scratch file, are flushed to the device, and
/// only then replace the original in a single `rename` — atomic within one
/// filesystem, so a reader sees either every old byte or every new one, never a
/// mixture. Any failure before the rename leaves the original untouched and
/// takes the scratch file with it.
///
/// The scratch file is a *sibling* because `rename` is only atomic within one
/// filesystem and the system temp directory routinely is not. It is dot-
/// prefixed by convention only — this tree's axis is "ignored", not "hidden",
/// so nothing filters it; it exists for the length of one write, and the
/// watcher follows the open file rather than its folder, so no listing
/// refreshes to catch it.
///
/// A symlinked document (`CLAUDE.md -> AGENTS.md`) is written *through* the
/// link: renaming over the link itself would replace it with a regular file and
/// silently fork the two documents. So the real path is resolved first and the
/// scratch file lands beside the target, where the rename stays atomic. A link
/// whose target is missing has nothing to resolve to and is written as before.
fn write_atomic(path: &Path, contents: &[u8]) -> std::io::Result<()> {
    let resolved = resolve_link(path);
    let path = resolved.as_deref().unwrap_or(path);
    let dir = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."));
    let name = path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| "file".to_string());
    let temp = dir.join(format!(
        ".{name}.{}.{}.tmp",
        std::process::id(),
        TEMP_SERIAL.fetch_add(1, Ordering::Relaxed)
    ));

    if let Err(err) = fill(&temp, contents) {
        let _ = std::fs::remove_file(&temp);
        return Err(err);
    }
    // A save must not change who can read the document: a fresh file is created
    // with default permissions, so carry the original's across. Best effort —
    // on a filesystem that will not take them the save is still correct.
    if let Ok(existing) = std::fs::metadata(path) {
        let _ = std::fs::set_permissions(&temp, existing.permissions());
    }
    if let Err(err) = std::fs::rename(&temp, path) {
        let _ = std::fs::remove_file(&temp);
        return Err(err);
    }
    sync_dir(dir);
    Ok(())
}

/// The file a symlink at `path` ultimately points to, or `None` when `path` is
/// not a symlink (the common case pays one `lstat`) or its target cannot be
/// resolved.
fn resolve_link(path: &Path) -> Option<PathBuf> {
    let is_link = std::fs::symlink_metadata(path).is_ok_and(|meta| meta.file_type().is_symlink());
    if !is_link {
        return None;
    }
    std::fs::canonicalize(path).ok()
}

/// Write the scratch file and get it onto the device. The handle is closed at
/// the end of the scope, before any rename: Windows will not rename an open
/// file, and `sync_all` is worth nothing if the bytes are still in the
/// process's buffers.
fn fill(temp: &Path, contents: &[u8]) -> std::io::Result<()> {
    let mut file = File::create(temp)?;
    file.write_all(contents)?;
    file.sync_all()
}

/// On POSIX the rename itself only survives a power loss once the *directory*
/// entry is flushed. Best effort: a save that already succeeded is not failed
/// because the directory could not be synced. Windows exposes no directory
/// handle to sync, and its rename is journaled anyway.
#[cfg(unix)]
fn sync_dir(dir: &Path) {
    if let Ok(handle) = File::open(dir) {
        let _ = handle.sync_all();
    }
}

#[cfg(not(unix))]
fn sync_dir(_dir: &Path) {}

#[tauri::command(async)]
pub fn write_text_file(
    path: String,
    contents: String,
    self_write: State<'_, SelfWriteState>,
    watcher: State<'_, WatcherState>,
) -> AppResult<()> {
    write_atomic(Path::new(&path), contents.as_bytes()).map_err(|err| AppError::at(&path, err))?;
    // Mark this as our own write so the file watcher ignores the resulting event.
    self_write.record(&path);
    // The save replaced the file rather than rewriting it in place, so the
    // watch is now pointing at an inode nothing will ever touch again. Re-arm
    // it, or external-change detection would end at the first save. A symlinked
    // document keeps the path the frontend knows: watching the link follows it
    // to the target's new inode, and events come back under the same name the
    // self-write guard recorded.
    watcher.rearm(&path);
    Ok(())
}

#[tauri::command]
pub fn path_exists(path: String) -> AppResult<bool> {
    Ok(Path::new(&path).exists())
}

/// Whether `entry` is a directory symlink pointing at the folder being listed,
/// or at one of its ancestors — a branch that can be opened forever, because
/// every level of it shows the same contents again.
///
/// `workspace::walk` and `search::walk` refuse to descend twice into the same
/// canonical directory; a single `read_dir` has no walk to remember, so it
/// checks the one shape that actually loops. Only symlinks pay for the two
/// `canonicalize` calls, and the folder's own resolution is done once.
fn loops_back(
    entry: &std::fs::DirEntry,
    entry_path: &Path,
    dir: &Path,
    resolved_dir: &mut Option<Option<PathBuf>>,
) -> bool {
    if !entry.file_type().is_ok_and(|kind| kind.is_symlink()) {
        return false;
    }
    let Ok(target) = entry_path.canonicalize() else {
        return false;
    };
    resolved_dir
        .get_or_insert_with(|| dir.canonicalize().ok())
        .as_ref()
        .is_some_and(|here| here.starts_with(&target))
}

/// List a directory for the file tree.
///
/// Generated/vendored folders are *flagged*, not dropped: the client hides them
/// by default but still knows they exist, so a folder holding nothing but
/// `node_modules` is never reported as empty — and toggling the setting can
/// re-filter in memory instead of re-reading the disk. Only one level is ever
/// listed, so keeping a handful of flagged rows costs nothing; what the flag
/// prevents is descending into them.
///
/// Everything else in the folder is listed as it is: this is a directory
/// listing, not a document query, and the themes folder browses `.css` through
/// the same command. Which rows the *tree* keeps is `visibleEntries`' job.
///
/// Directory-ness resolves symlinks, so a symlinked `docs/` is a branch the
/// user can open — and `workspace::walk` / `search::walk` follow them too, so
/// what the tree shows is what quick-open and search can reach. A symlink that
/// points back at its own folder is flagged instead: it is not content, and
/// expanding it never ends.
///
/// `root` is the workspace folder. The walkers carry the `.gitignore` files
/// down with them; this lists one directory out of context, so it rebuilds the
/// chain from the root instead. Without a root only `path`'s own file applies,
/// which is the honest answer for a folder browsed outside a workspace.
#[tauri::command(async)]
pub fn read_dir(path: String, root: Option<String>) -> AppResult<DirListing> {
    let dir = Path::new(&path);
    let root_path = root.as_deref().map_or(dir, Path::new);
    let ignores = crate::fs_policy::ignore_stack(root_path, dir);
    let exempt = dir
        .strip_prefix(root_path)
        .unwrap_or(Path::new(""))
        .components()
        .any(|part| crate::fs_policy::is_always_visible_dir(&part.as_os_str().to_string_lossy()));

    let mut entries = Vec::new();
    let mut total = 0usize;
    let mut scanned = 0usize;
    let mut resolved_dir = None;
    for entry in std::fs::read_dir(dir).map_err(|err| AppError::at(dir, err))? {
        total += 1;
        // Past the cap the stream is only counted, not examined: walking it
        // costs one readdir buffer, while the `is_dir` stat per entry is what
        // makes a huge folder expensive.
        if scanned >= MAX_DIR_ENTRIES {
            continue;
        }
        scanned += 1;
        let entry = entry.map_err(|err| AppError::at(dir, err))?;
        let name = entry.file_name().to_string_lossy().into_owned();
        let entry_path = entry.path();
        let is_dir = entry_path.is_dir();
        let ignored =
            crate::fs_policy::is_ignored_entry(&name, &entry_path, is_dir, &ignores, exempt)
                || (is_dir && loops_back(&entry, &entry_path, dir, &mut resolved_dir));
        entries.push(DirEntry {
            ignored,
            name,
            path: entry_path.to_string_lossy().into_owned(),
            is_dir,
        });
    }
    Ok(DirListing {
        entries,
        total,
        scanned,
    })
}

/// Move a path to the OS trash. We never hard-delete user files (CLAUDE.md).
#[tauri::command(async)]
pub fn move_to_trash(path: String) -> AppResult<()> {
    trash::delete(&path).map_err(|err| AppError::Trash(err.to_string()))?;
    Ok(())
}

/// Create a new empty file. Fails if a file already exists at the path.
#[tauri::command]
pub fn create_file(path: String) -> AppResult<()> {
    create_new_file(Path::new(&path))
}

/// Create `path` empty, refusing in the same system call if anything is there.
///
/// An `exists()` check followed by a write left a window in which a file
/// created meanwhile (another app, a `git checkout`) was truncated to nothing.
/// `create_new` is the check and the create at once, so the "never overwrite"
/// contract holds without a race.
fn create_new_file(path: &Path) -> AppResult<()> {
    std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map(drop)
        .map_err(|err| match err.kind() {
            std::io::ErrorKind::AlreadyExists => {
                AppError::AlreadyExists(path.to_string_lossy().into_owned())
            }
            _ => AppError::at(path, err),
        })
}

/// Rename (move) a file or folder. Fails if the source is missing or the target
/// already exists, so an existing file is never silently overwritten.
#[tauri::command]
pub fn rename_path(from: String, to: String) -> AppResult<()> {
    if !Path::new(&from).exists() {
        return Err(AppError::NotFound(from));
    }
    if Path::new(&to).exists() {
        return Err(AppError::AlreadyExists(to));
    }
    std::fs::rename(&from, &to).map_err(|err| AppError::at(&from, err))?;
    Ok(())
}

/// Read the bundled THIRD-PARTY-NOTICES.txt so the app can surface its
/// open-source license notices from Settings. In a packaged app the file
/// resolves under `BaseDirectory::Resource`; `resolve` only builds a path and
/// does not guarantee existence, so a missing/unreadable file (e.g. in some dev
/// setups) surfaces as an `AppError` the frontend can localize gracefully.
#[tauri::command]
pub fn read_third_party_notices(app: AppHandle) -> AppResult<String> {
    let path = app
        .path()
        .resolve("THIRD-PARTY-NOTICES.txt", BaseDirectory::Resource)
        .map_err(|err| AppError::Resource(err.to_string()))?;
    if !path.exists() {
        return Err(AppError::NotFound(path.to_string_lossy().into_owned()));
    }
    std::fs::read_to_string(&path).map_err(|err| AppError::at(&path, err))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_write_roundtrip() {
        let mut path = std::env::temp_dir();
        path.push(format!("asterisco_test_{}.txt", std::process::id()));
        let path_str = path.to_string_lossy().into_owned();

        // write_text_file needs Tauri-managed state; exercise the read path
        // against a plain write (the command only adds self-write bookkeeping).
        std::fs::write(&path, "hello").unwrap();
        assert_eq!(read_text_file(path_str.clone()).unwrap(), "hello");
        assert!(path_exists(path_str.clone()).unwrap());

        std::fs::remove_file(&path).unwrap();
    }

    /// The point of the scratch file is that it does not outlive the save:
    /// leaving `.README.md.1234.0.tmp` behind would put litter in the user's
    /// repository, and a repository is exactly what this tree shows.
    #[test]
    fn an_atomic_write_replaces_the_file_and_leaves_nothing_behind() {
        let dir = temp_dir("atomic");
        let file = dir.join("README.md");
        std::fs::write(&file, "old").unwrap();

        write_atomic(&file, b"new").unwrap();

        assert_eq!(std::fs::read_to_string(&file).unwrap(), "new");
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name != "README.md")
            .collect();
        assert!(
            leftovers.is_empty(),
            "scratch file left behind: {leftovers:?}"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// The failure the plain `std::fs::write` could not survive: it truncated
    /// the original first, so anything going wrong afterwards destroyed the
    /// document. Here the rename is the only step that touches the original,
    /// and it either happens or it does not.
    #[test]
    fn a_failed_write_leaves_the_previous_contents_intact() {
        let dir = temp_dir("atomic_fail");
        let file = dir.join("notes.md");
        std::fs::write(&file, "precious").unwrap();

        // A directory in the way: the scratch file is written fine, then the
        // rename onto a non-empty directory fails. Any failure at or before the
        // rename must leave the original exactly as it was.
        let occupied = dir.join("occupied.md");
        std::fs::create_dir(&occupied).unwrap();
        std::fs::write(occupied.join("inside"), "x").unwrap();

        assert!(write_atomic(&occupied, b"new").is_err());
        assert_eq!(
            std::fs::read_to_string(&file).unwrap(),
            "precious",
            "an unrelated document must not be touched"
        );
        assert!(occupied.is_dir(), "the rename target survived");
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "a failed save left its scratch file behind: {leftovers:?}"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// An unwritable folder is the everyday version of "the save failed":
    /// a read-only checkout, a permission change, a mounted volume gone
    /// read-only. The document must still be there afterwards.
    #[cfg(unix)]
    #[test]
    fn a_write_into_an_unwritable_folder_keeps_the_document() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("atomic_readonly");
        let file = dir.join("doc.md");
        std::fs::write(&file, "kept").unwrap();
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o555)).unwrap();

        // Root ignores the permission bits entirely, so the failure this test
        // needs cannot be produced; skip rather than assert something false.
        let enforced = std::fs::File::create(dir.join(".canary")).is_err();
        if enforced {
            assert!(write_atomic(&file, b"new").is_err());
            assert_eq!(std::fs::read_to_string(&file).unwrap(), "kept");
        }

        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o755)).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// A save must not quietly widen or narrow who can read the document.
    #[cfg(unix)]
    #[test]
    fn an_atomic_write_keeps_the_original_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let dir = temp_dir("atomic_perms");
        let file = dir.join("private.md");
        std::fs::write(&file, "old").unwrap();
        std::fs::set_permissions(&file, std::fs::Permissions::from_mode(0o600)).unwrap();

        write_atomic(&file, b"new").unwrap();

        let mode = std::fs::metadata(&file).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "permissions were reset by the save");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// `CLAUDE.md -> AGENTS.md` is the convention among exactly the files this
    /// editor is for. Renaming the scratch file over the *link* turned it into
    /// a copy, and from then on the two agent briefs silently diverged.
    #[cfg(unix)]
    #[test]
    fn saving_through_a_symlink_keeps_the_link_and_updates_its_target() {
        let dir = temp_dir("atomic_symlink");
        let real = dir.join("AGENTS.md");
        let link = dir.join("CLAUDE.md");
        std::fs::write(&real, "old").unwrap();
        // Relative, as `ln -s AGENTS.md CLAUDE.md` makes it.
        std::os::unix::fs::symlink("AGENTS.md", &link).unwrap();

        write_atomic(&link, b"new").unwrap();

        assert!(
            std::fs::symlink_metadata(&link)
                .unwrap()
                .file_type()
                .is_symlink(),
            "the save replaced the link with a regular file"
        );
        assert_eq!(std::fs::read_link(&link).unwrap(), Path::new("AGENTS.md"));
        assert_eq!(std::fs::read_to_string(&real).unwrap(), "new");
        let leftovers: Vec<_> = std::fs::read_dir(&dir)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .filter(|name| name.ends_with(".tmp"))
            .collect();
        assert!(
            leftovers.is_empty(),
            "scratch file left behind: {leftovers:?}"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// The scratch file has to land beside the *target*: a link in one folder
    /// pointing into another (possibly another filesystem) must not rename
    /// across folders, and the link's own folder must not get the litter.
    #[cfg(unix)]
    #[test]
    fn saving_through_a_symlink_into_another_folder_writes_there() {
        let dir = temp_dir("atomic_symlink_far");
        let shared = dir.join("shared");
        let project = dir.join("project");
        std::fs::create_dir_all(&shared).unwrap();
        std::fs::create_dir_all(&project).unwrap();
        let real = shared.join("AGENTS.md");
        let link = project.join("CLAUDE.md");
        std::fs::write(&real, "old").unwrap();
        std::os::unix::fs::symlink(&real, &link).unwrap();

        write_atomic(&link, b"new").unwrap();

        assert!(std::fs::symlink_metadata(&link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read_to_string(&real).unwrap(), "new");
        assert_eq!(std::fs::read_to_string(&link).unwrap(), "new");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// A link whose target is gone has nothing to resolve to: the save falls
    /// back to writing at the path the user sees, exactly as before.
    #[cfg(unix)]
    #[test]
    fn saving_through_a_dangling_symlink_still_saves() {
        let dir = temp_dir("atomic_symlink_dangling");
        let link = dir.join("CLAUDE.md");
        std::os::unix::fs::symlink(dir.join("gone.md"), &link).unwrap();

        write_atomic(&link, b"new").unwrap();

        assert_eq!(std::fs::read_to_string(&link).unwrap(), "new");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn read_missing_file_is_not_found() {
        let result = read_text_file("/nonexistent/asterisco/does-not-exist.md".into());
        assert!(matches!(result, Err(AppError::NotFound(_))));
    }

    #[test]
    fn create_file_creates_and_refuses_to_overwrite() {
        let mut path = std::env::temp_dir();
        path.push(format!("asterisco_create_{}.md", std::process::id()));
        let path_str = path.to_string_lossy().into_owned();

        create_file(path_str.clone()).unwrap();
        assert!(path.exists());
        // A second create must not overwrite.
        assert!(matches!(
            create_file(path_str.clone()),
            Err(AppError::AlreadyExists(_))
        ));

        std::fs::remove_file(&path).unwrap();
    }

    /// The pre-check alone left a window: a file created between `exists()`
    /// and the write was truncated to nothing. The create itself must refuse.
    #[test]
    fn create_file_never_truncates_an_existing_file() {
        let dir = temp_dir("create_existing");
        let file = dir.join("notes.md");
        std::fs::write(&file, "precious").unwrap();

        let error = create_new_file(&file).unwrap_err();
        assert!(matches!(error, AppError::AlreadyExists(_)));
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "precious");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("asterisco_dir_{tag}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn list(dir: &Path) -> DirListing {
        read_dir(
            dir.to_string_lossy().into_owned(),
            Some(dir.to_string_lossy().into_owned()),
        )
        .unwrap()
    }

    /// A plain directory listing, not a document query: the themes folder
    /// browses `.css` through this same command, and the tree keeps its own
    /// rule about which rows it draws.
    #[test]
    fn lists_the_folder_as_it_is_and_counts_all_of_it() {
        let dir = temp_dir("listing");
        std::fs::create_dir_all(dir.join("sub")).unwrap();
        std::fs::write(dir.join("README.md"), "r").unwrap();
        std::fs::write(dir.join("logo.png"), "p").unwrap();

        let listing = list(&dir);
        let names: Vec<_> = listing.entries.iter().map(|e| e.name.clone()).collect();
        assert_eq!(names.len(), 3, "{names:?}");
        assert!(names.contains(&"logo.png".to_string()), "{names:?}");
        assert_eq!(listing.total, 3);
        assert_eq!(listing.scanned, 3);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// The cap exists because a 50,000-entry folder costs 416 ms and 6.9 MB.
    /// It must be reported, not silently applied: `scanned < total` is the only
    /// thing standing between a prefix and a false statement about the disk.
    #[test]
    fn a_huge_folder_stops_at_the_cap_and_says_how_far_it_looked() {
        let dir = temp_dir("cap");
        for i in 0..(MAX_DIR_ENTRIES + 25) {
            std::fs::write(dir.join(format!("doc{i:05}.md")), "x").unwrap();
        }

        let listing = list(&dir);
        assert_eq!(listing.entries.len(), MAX_DIR_ENTRIES);
        assert_eq!(listing.scanned, MAX_DIR_ENTRIES);
        assert_eq!(
            listing.total,
            MAX_DIR_ENTRIES + 25,
            "entries past the cap are counted even though they are not examined"
        );

        std::fs::remove_dir_all(&dir).unwrap();
    }

    /// A self-referential symlink stayed expandable forever: every level listed
    /// the same contents again. The walkers dedupe canonical paths; this is the
    /// one-directory equivalent.
    #[cfg(unix)]
    #[test]
    fn a_symlink_that_points_at_its_own_folder_is_not_content() {
        let dir = temp_dir("cycle");
        let docs = dir.join("docs");
        std::fs::create_dir_all(&docs).unwrap();
        std::os::unix::fs::symlink(&dir, docs.join("loop")).unwrap();
        std::os::unix::fs::symlink(&dir, docs.join("self")).unwrap();
        // A symlink to somewhere else entirely is an ordinary branch.
        let elsewhere = temp_dir("cycle_target");
        std::os::unix::fs::symlink(&elsewhere, docs.join("elsewhere")).unwrap();

        let listing = list(&docs);
        let flagged = |name: &str| {
            listing
                .entries
                .iter()
                .find(|entry| entry.name == name)
                .unwrap_or_else(|| panic!("{name} missing"))
                .ignored
        };
        assert!(flagged("loop"), "a symlink to an ancestor loops");
        assert!(flagged("self"));
        assert!(
            !flagged("elsewhere"),
            "a symlinked folder is still a branch"
        );

        std::fs::remove_dir_all(&dir).unwrap();
        std::fs::remove_dir_all(&elsewhere).unwrap();
    }

    /// The panel can only say *what* it could not read if the error carries the
    /// path, and *why* if it carries the errno.
    #[test]
    fn an_unreadable_folder_reports_the_path_and_the_cause() {
        let missing = std::env::temp_dir().join("asterisco_no_such_folder_ever");
        let _ = std::fs::remove_dir_all(&missing);
        let error = read_dir(missing.to_string_lossy().into_owned(), None).unwrap_err();
        let value = serde_json::to_value(error).unwrap();
        assert_eq!(value["kind"], "notFound");
        assert_eq!(value["path"], missing.to_string_lossy().as_ref());
    }

    #[test]
    fn rename_moves_and_refuses_existing_target() {
        let dir = std::env::temp_dir().join(format!("asterisco_rename_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let from = dir.join("a.md");
        let to = dir.join("b.md");
        std::fs::write(&from, "x").unwrap();

        rename_path(
            from.to_string_lossy().into_owned(),
            to.to_string_lossy().into_owned(),
        )
        .unwrap();
        assert!(!from.exists() && to.exists());

        // Renaming onto an existing target must fail.
        std::fs::write(&from, "y").unwrap();
        assert!(matches!(
            rename_path(
                from.to_string_lossy().into_owned(),
                to.to_string_lossy().into_owned(),
            ),
            Err(AppError::AlreadyExists(_))
        ));

        std::fs::remove_dir_all(&dir).unwrap();
    }
}
