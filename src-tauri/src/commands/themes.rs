use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use notify::RecursiveMode;
use notify_debouncer_full::{new_debouncer, DebounceEventResult};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::watcher::DebouncerSlot;
use crate::error::{AppError, AppResult};

/// Commented starter theme written into the folder the first time it is created.
/// Lists the overridable semantic tokens for light (`:root`) and dark (`.dark`).
/// `@import` and remote `url(http…)` are stripped on load, so they are omitted.
const EXAMPLE_CSS: &str = "\
/*\n\
 * Example custom theme — Asterisco\n\
 *\n\
 * Override any semantic token below. Values cascade live (hot-reload): save\n\
 * this file and the app re-applies it. Pick this theme in Settings → Appearance.\n\
 *\n\
 * Security: `@import` and remote `url(http://…)` are stripped on load.\n\
 * Only edit the token values; keep the selectors as-is.\n\
 *\n\
 * Two rules worth keeping (the built-in palette is measured against them):\n\
 *  - `--primary` is a FILL THAT CARRIES TEXT, so it must reach 4.5:1 against\n\
 *    `--primary-fg` (white in light, `--bg` in dark). `--accent` is the signal\n\
 *    used for dots and borders only, so it can be brighter.\n\
 *  - `--ring` needs 3:1 against `--bg`. Using the same value as `--primary` is\n\
 *    the easy way to stay safe; a lighter tint usually is not.\n\
 */\n\
\n\
:root {\n\
  /* App background / text */\n\
  --bg: #fcfcfc;\n\
  --fg: #1c1c1c;\n\
  --surface: #f6f6f6;\n\
  --muted: #ededed;\n\
  --muted-fg: #5f5f5f;\n\
  --border: #dcdcdc;\n\
  /* Solid fill (7.8:1 under white) + signal + ring (7.6:1 on the page) */\n\
  --primary: #0f5d4a;\n\
  --accent: #17a67f;\n\
  --ring: #0f5d4a;\n\
  --selection: #cdeede;\n\
}\n\
\n\
.dark {\n\
  --bg: #131313;\n\
  --fg: #ededed;\n\
  --surface: #1b1b1b;\n\
  --muted: #262626;\n\
  --muted-fg: #a1a1a1;\n\
  --border: #363636;\n\
  /* Bright fill: the page ink sits on it at 10.2:1 */\n\
  --primary: #4fd6ac;\n\
  --accent: #17a67f;\n\
  --ring: #4fd6ac;\n\
  --selection: #163b30;\n\
}\n";

/// Resolve `<base>/themes`, creating it if missing. The first time the folder is
/// created, seed `example.css`. If the folder already exists, leave its contents
/// untouched (so a user who deletes `example.css` does not get it back).
fn ensure_themes_dir_at(base: &Path) -> AppResult<PathBuf> {
    let dir = base.join("themes");
    let freshly_created = !dir.exists();
    fs::create_dir_all(&dir).map_err(|e| AppError::at(&dir, e))?;
    if freshly_created {
        let example = dir.join("example.css");
        fs::write(&example, EXAMPLE_CSS).map_err(|e| AppError::at(&example, e))?;
    }
    Ok(dir)
}

/// Resolve (creating + seeding if needed) the managed themes folder and return
/// its absolute path. All theme files live under the app-config dir.
#[tauri::command]
pub fn ensure_themes_dir(app: AppHandle) -> AppResult<String> {
    let base = app
        .path()
        .app_config_dir()
        .map_err(|err| crate::error::AppError::Resource(err.to_string()))?;
    let dir = ensure_themes_dir_at(&base)?;
    Ok(dir.to_string_lossy().into_owned())
}

const THEMES_DEBOUNCE: Duration = Duration::from_millis(300);

/// The themes-folder watcher's slot. A type of its own, independent of the
/// document `WatcherState`, so the two never collide in Tauri's state map.
#[derive(Default)]
pub struct ThemesWatcherState(DebouncerSlot);

#[derive(Clone, Serialize)]
struct ThemesChangedPayload {
    path: String,
}

/// Watch the themes folder (non-recursive) for any change. Emits
/// `themes-dir-changed` per changed path. No self-write guard: the app never
/// writes theme files at runtime (example.css is seeded before any watch starts).
#[tauri::command]
pub fn start_themes_watch(
    path: String,
    app: AppHandle,
    state: State<'_, ThemesWatcherState>,
) -> AppResult<()> {
    state.0.replace(None);

    let mut debouncer = new_debouncer(THEMES_DEBOUNCE, None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        for event in events {
            for changed in &event.paths {
                let _ = app.emit(
                    "themes-dir-changed",
                    ThemesChangedPayload {
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

    state.0.replace(Some(debouncer));
    Ok(())
}

/// Stop watching the themes folder, if active.
#[tauri::command]
pub fn stop_themes_watch(state: State<'_, ThemesWatcherState>) -> AppResult<()> {
    state.0.replace(None);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ensure_themes_dir_at;
    use std::fs;

    fn temp_base(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("asterisco-themes-test-{tag}"));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn creates_dir_and_seeds_example_on_first_run() {
        let base = temp_base("seed");
        let themes = ensure_themes_dir_at(&base).unwrap();
        assert!(themes.is_dir());
        let example = themes.join("example.css");
        assert!(example.is_file());
        assert!(fs::read_to_string(&example).unwrap().contains("--primary"));
        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn does_not_reseed_after_user_deletes_example() {
        let base = temp_base("noreseed");
        let themes = ensure_themes_dir_at(&base).unwrap();
        fs::remove_file(themes.join("example.css")).unwrap();
        // Second call: folder already exists -> must not recreate example.css.
        ensure_themes_dir_at(&base).unwrap();
        assert!(!themes.join("example.css").exists());
        fs::remove_dir_all(&base).unwrap();
    }
}
