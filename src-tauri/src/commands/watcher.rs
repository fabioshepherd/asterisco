use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use notify::{EventKind, RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::error::{AppError, AppResult};

const DEBOUNCE: Duration = Duration::from_millis(300);
/// How long after our own save a matching FS event is treated as a self-write.
/// Covers the debounce timeout plus its tick rate with headroom.
const SELF_WRITE_WINDOW: Duration = Duration::from_millis(500);

/// Records the path + time of our own writes so the watcher can ignore them
/// (otherwise saving would trigger a "changed on disk" reload prompt loop).
#[derive(Clone, Default)]
pub struct SelfWriteState(Arc<Mutex<Option<(PathBuf, Instant)>>>);

impl SelfWriteState {
    pub fn record(&self, path: &str) {
        if let Ok(mut guard) = self.0.lock() {
            *guard = Some((PathBuf::from(path), Instant::now()));
        }
    }

    fn is_self_write(&self, path: &Path) -> bool {
        match self.0.lock() {
            Ok(guard) => guard
                .as_ref()
                .is_some_and(|(saved, at)| saved == path && at.elapsed() < SELF_WRITE_WINDOW),
            Err(_) => false,
        }
    }
}

type AppDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Holds at most one active debouncer; replacing it stops the previous one.
/// Shared by the document watcher and the themes watcher, which each wrap their
/// own slot in a distinct state type so the two never collide.
#[derive(Default)]
pub struct DebouncerSlot(Mutex<Option<AppDebouncer>>);

impl DebouncerSlot {
    /// Lock the slot. A poisoned mutex (a panic elsewhere while it was held)
    /// still holds a valid `Option`, so recover it instead of panicking in a command.
    fn lock(&self) -> MutexGuard<'_, Option<AppDebouncer>> {
        self.0.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Swap in `next` (or clear with `None`) and stop the previous debouncer
    /// outside the lock, since its stop joins a thread.
    pub fn replace(&self, next: Option<AppDebouncer>) {
        let previous = std::mem::replace(&mut *self.lock(), next);
        if let Some(debouncer) = previous {
            debouncer.stop_nonblocking();
        }
    }
}

/// The document watcher's slot.
#[derive(Default)]
pub struct WatcherState(DebouncerSlot);

impl WatcherState {
    /// Point the watch at `path` again after an atomic save replaced the file.
    ///
    /// A save writes a scratch file and renames it over the original, so the
    /// document the user is editing is a *new* inode. inotify watches inodes,
    /// not names: without this the watch would still be following the replaced
    /// one, and external-change detection would quietly stop working at the
    /// first save. Re-watching the same path is idempotent on the backends that
    /// track names instead, so this is unconditional.
    ///
    /// Best effort: the save has already succeeded on disk, and failing it
    /// because a watch could not be re-armed would be the worse outcome.
    pub fn rearm(&self, path: &str) {
        if let Some(debouncer) = self.0.lock().as_mut() {
            let _ = debouncer.watch(Path::new(path), RecursiveMode::NonRecursive);
        }
    }
}

#[derive(Clone, Serialize)]
struct FileChangedPayload {
    path: String,
}

/// Whether an event kind means the watched file was removed (deleted or
/// renamed away). The frontend treats either as "the file is gone".
fn is_removal(kind: EventKind) -> bool {
    matches!(kind, EventKind::Remove(_))
}

/// Watch a single file for external changes (replaces any previous watch).
#[tauri::command]
pub fn start_watch(
    path: String,
    app: AppHandle,
    watcher_state: State<'_, WatcherState>,
    self_write: State<'_, SelfWriteState>,
) -> AppResult<()> {
    watcher_state.0.replace(None);

    let self_write = self_write.inner().clone();
    let mut debouncer = new_debouncer(DEBOUNCE, None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        for event in events {
            let removed = is_removal(event.kind);
            for changed in &event.paths {
                // A genuine deletion bypasses the self-write guard: only when
                // the event is a removal AND the path is actually gone after
                // the batch settles do we announce it. Atomic-replace saves
                // (write temp -> rename over original) emit a Remove for the
                // original immediately followed by a Create/Modify in the same
                // batch, so the path still exists -> fall through to the
                // self-write guard + "file-changed" and treat it as a normal
                // change. `try_exists().unwrap_or(false)` avoids a false delete
                // on a transient stat error.
                if removed && !changed.try_exists().unwrap_or(false) {
                    let _ = app.emit(
                        "file-deleted",
                        FileChangedPayload {
                            path: changed.to_string_lossy().into_owned(),
                        },
                    );
                    continue;
                }
                if self_write.is_self_write(changed) {
                    continue;
                }
                let _ = app.emit(
                    "file-changed",
                    FileChangedPayload {
                        path: changed.to_string_lossy().into_owned(),
                    },
                );
            }
        }
    })
    .map_err(|err| AppError::Watch(err.to_string()))?;

    debouncer
        .watch(Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|err| AppError::Watch(err.to_string()))?;

    watcher_state.0.replace(Some(debouncer));
    Ok(())
}

/// Stop watching, if a watcher is active.
#[tauri::command]
pub fn stop_watch(watcher_state: State<'_, WatcherState>) -> AppResult<()> {
    watcher_state.0.replace(None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_removal, DebouncerSlot};
    use notify::event::{AccessKind, CreateKind, ModifyKind, RemoveKind};
    use notify::EventKind;

    #[test]
    fn removal_kinds_are_detected() {
        assert!(is_removal(EventKind::Remove(RemoveKind::File)));
        assert!(is_removal(EventKind::Remove(RemoveKind::Folder)));
        assert!(is_removal(EventKind::Remove(RemoveKind::Any)));
    }

    #[test]
    fn non_removal_kinds_are_ignored() {
        assert!(!is_removal(EventKind::Modify(ModifyKind::Any)));
        assert!(!is_removal(EventKind::Create(CreateKind::File)));
        assert!(!is_removal(EventKind::Access(AccessKind::Any)));
        assert!(!is_removal(EventKind::Any));
        assert!(!is_removal(EventKind::Other));
    }

    #[test]
    fn slot_survives_a_poisoned_lock() {
        let slot = std::sync::Arc::new(DebouncerSlot::default());
        let poisoner = slot.clone();
        let _ = std::thread::spawn(move || {
            let _guard = poisoner.0.lock().unwrap();
            panic!("poison the slot");
        })
        .join();
        assert!(slot.0.is_poisoned());
        // Neither call may panic: they recover the (empty) slot.
        slot.replace(None);
        assert!(slot.lock().is_none());
    }
}
