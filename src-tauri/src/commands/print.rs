//! The print window, created here rather than by the frontend.
//!
//! A window the frontend creates can start on any URL it names, and the
//! navigation guard (`navigation.rs`) does not see a webview's initial load.
//! Creating it in Rust, always on the app's own print page, lets the main
//! window drop `core:webview:allow-create-webview-window`: a compromised
//! frontend can no longer open a window on a remote page. The print window's
//! own permissions are in `capabilities/print.json`.

use std::sync::atomic::{AtomicU32, Ordering};

use tauri::{AppHandle, Runtime, WebviewUrl, WebviewWindowBuilder};

use crate::error::AppError;

/// The page a print window loads: the app bundle in print mode (`src/main.tsx`).
pub const PRINT_PAGE: &str = "index.html?print=1";

/// Window labels start with this; `capabilities/print.json` matches `print-*`.
pub const PRINT_LABEL_PREFIX: &str = "print-";

static PRINT_COUNTER: AtomicU32 = AtomicU32::new(0);

/// A fresh label for the next print window.
fn next_print_label() -> String {
    let n = PRINT_COUNTER.fetch_add(1, Ordering::Relaxed) + 1;
    format!("{PRINT_LABEL_PREFIX}{n}")
}

/// Open a print window on the app's print page and return its label.
///
/// `async` because creating a window from a synchronous command deadlocks on
/// Windows (see `WebviewWindowBuilder::new`).
#[tauri::command]
pub async fn open_print_window<R: Runtime>(
    app: AppHandle<R>,
    title: String,
) -> Result<String, AppError> {
    let label = next_print_label();
    WebviewWindowBuilder::new(&app, &label, WebviewUrl::App(PRINT_PAGE.into()))
        .title(title)
        .inner_size(820.0, 1060.0)
        .visible(true)
        .focused(true)
        .build()
        .map_err(|e| AppError::Resource(format!("print window: {e}")))?;
    Ok(label)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_are_unique_and_match_the_print_capability() {
        let first = next_print_label();
        let second = next_print_label();
        assert_ne!(first, second);
        assert!(first.starts_with(PRINT_LABEL_PREFIX));

        let capability: serde_json::Value =
            serde_json::from_str(include_str!("../../capabilities/print.json")).unwrap();
        assert_eq!(capability["windows"], serde_json::json!(["print-*"]));
    }

    #[test]
    fn the_print_page_is_one_the_navigation_guard_allows() {
        let base = tauri::Url::parse("tauri://localhost/").unwrap();
        let url = base.join(PRINT_PAGE).unwrap();
        assert!(crate::navigation::is_app_url(&url, None));
    }
}
