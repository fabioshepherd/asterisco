//! Files handed to the app by the OS rather than chosen inside it: a double
//! click in Finder/Explorer, an "Open with", a path on the command line, or a
//! second launch while the app is already running.
//!
//! PRODUCT.md's first principle is "open and see" — this app is usually reached
//! *from the file*, not from the app — so this path has to be as reliable as the
//! Open dialog. Those paths can arrive before the webview exists (a cold launch
//! from Finder) or long after it does (a second double-click), so they are
//! queued here in Rust and drained by the frontend when it is ready. Later
//! arrivals push onto the same queue and only *notify* the frontend, which then
//! drains it: one source of truth, so no file is opened twice and none is lost
//! to a listener that had not attached yet.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, Runtime, State};

/// Carries no payload on purpose: the queue is the truth, the event is a nudge.
const PENDING_EVENT: &str = "files-pending";

/// Paths waiting for a frontend able to open them.
#[derive(Default)]
pub struct PendingFiles(Mutex<Vec<String>>);

/// Turn process arguments into openable paths.
///
/// The first argument is the executable and is always skipped. Anything that
/// looks like a flag is skipped too, and what is left has to actually be a file
/// on disk — a dev-server argument or a typo must never reach the editor as a
/// document. Relative paths resolve against the caller's working directory,
/// which is what the single-instance plugin hands us for a second launch.
pub fn paths_from_args<I: IntoIterator<Item = String>>(args: I, cwd: &Path) -> Vec<PathBuf> {
    args.into_iter()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .map(|arg| {
            let path = PathBuf::from(arg);
            if path.is_absolute() {
                path
            } else {
                cwd.join(path)
            }
        })
        .filter(|path| path.is_file())
        .collect()
}

/// Queue paths for the frontend and tell it there is something to drain.
pub fn queue<R: Runtime>(app: &AppHandle<R>, paths: Vec<PathBuf>) {
    if paths.is_empty() {
        return;
    }
    if let Some(state) = app.try_state::<PendingFiles>() {
        if let Ok(mut pending) = state.0.lock() {
            for path in paths {
                let path = path.to_string_lossy().into_owned();
                if !pending.contains(&path) {
                    pending.push(path);
                }
            }
        }
    }
    let _ = app.emit(PENDING_EVENT, ());
}

/// Bring the existing window forward — a second launch must feel like the app
/// answering, not like nothing happened.
pub fn focus_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Collect the paths this process was started with (Windows/Linux file
/// associations pass them on argv; macOS uses `RunEvent::Opened` instead, and
/// sends nothing here).
pub fn queue_launch_args<R: Runtime>(app: &AppHandle<R>) {
    let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    queue(app, paths_from_args(std::env::args(), &cwd));
}

/// Drain everything the OS has handed us since the last call.
#[tauri::command]
pub fn take_pending_files(state: State<'_, PendingFiles>) -> Vec<String> {
    match state.0.lock() {
        Ok(mut pending) => std::mem::take(&mut *pending),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn skips_the_executable_and_flags() {
        let dir = std::env::temp_dir();
        let paths = paths_from_args(
            vec![
                "/Applications/asterisco".to_string(),
                "--devtools".to_string(),
            ],
            &dir,
        );

        assert!(paths.is_empty());
    }

    #[test]
    fn resolves_a_relative_path_against_the_given_cwd() {
        let dir = std::env::temp_dir().join("asterisco-open-with-test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("README.md");
        std::fs::write(&file, "# hi").unwrap();

        let paths = paths_from_args(vec!["app".to_string(), "README.md".to_string()], &dir);

        assert_eq!(paths, vec![file.clone()]);
        std::fs::remove_file(file).unwrap();
    }

    #[test]
    fn drops_arguments_that_are_not_files_on_disk() {
        let dir = std::env::temp_dir();
        let paths = paths_from_args(
            vec!["app".to_string(), "definitely-not-a-file.md".to_string()],
            &dir,
        );

        assert!(paths.is_empty());
    }

    #[test]
    fn keeps_a_directory_out_of_the_editor() {
        let dir = std::env::temp_dir();
        let paths = paths_from_args(
            vec!["app".to_string(), dir.to_string_lossy().into_owned()],
            &dir,
        );

        assert!(paths.is_empty());
    }
}
