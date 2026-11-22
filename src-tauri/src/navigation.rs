//! Keeps every webview on the app's own pages.
//!
//! A link clicked in a document (or a URL dropped on the window) would
//! otherwise navigate the app window itself: a web page loads inside the app,
//! a relative link reloads it, and unsaved edits are lost without a prompt.
//! The frontend opens links on purpose (system browser, or a new tab); this
//! guard is the backstop that cancels any other navigation away from the app.

use tauri::plugin::{Builder, TauriPlugin};
use tauri::{Manager, Runtime, Url};

/// Whether `url` is the app's own page: the bundled frontend
/// (`tauri://localhost`, or `http(s)://tauri.localhost` on Windows/Android)
/// or, in a dev build, the dev server. Only the page itself (`/` or
/// `/index.html`, any query or fragment) is allowed: a relative link such as
/// `notes.md` resolves to `tauri://localhost/notes.md`, which would reload the
/// app (Vite serves `index.html` for unknown paths) and lose unsaved edits.
/// `?print=1`, `#fn-…` anchors and a reload of the current page stay allowed.
/// The empty path is the root too: macOS loads the app as `tauri://localhost`
/// with no slash, and for a non-special scheme such as `tauri:` the URL parser
/// keeps that path as `""` instead of normalizing it to `/`.
pub fn is_app_url(url: &Url, dev_url: Option<&Url>) -> bool {
    let bundled = match url.scheme() {
        "tauri" => url.host_str() == Some("localhost"),
        "http" | "https" => url.host_str() == Some("tauri.localhost"),
        _ => false,
    };
    let origin_ok = bundled || dev_url.is_some_and(|dev| dev.origin() == url.origin());
    origin_ok && matches!(url.path(), "" | "/" | "/index.html")
}

/// Plugin whose navigation hook cancels everything [`is_app_url`] rejects.
pub fn guard<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("navigation-guard")
        .on_navigation(|webview, url| {
            let dev_url = if tauri::is_dev() {
                webview.config().build.dev_url.as_ref()
            } else {
                None
            };
            let allowed = is_app_url(url, dev_url);
            if !allowed {
                tauri_plugin_log::log::warn!(
                    "blocked navigation of webview {} away from the app",
                    webview.label()
                );
            }
            allowed
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn allows_the_bundled_app_and_its_print_page() {
        assert!(is_app_url(&url("tauri://localhost/"), None));
        // macOS loads the app as `tauri://localhost` with no slash; for a
        // non-special scheme the parsed path is "" rather than "/".
        assert!(is_app_url(&url("tauri://localhost"), None));
        assert!(is_app_url(&url("tauri://localhost?print=1"), None));
        assert!(is_app_url(
            &url("tauri://localhost/index.html?print=1"),
            None
        ));
        assert!(is_app_url(&url("http://tauri.localhost/index.html"), None));
        assert!(is_app_url(&url("https://tauri.localhost/#fn-1"), None));
        assert!(is_app_url(&url("tauri://localhost/index.html#fn-1"), None));
    }

    #[test]
    fn allows_the_dev_server_only_when_given() {
        let dev = url("http://localhost:5173");
        assert!(is_app_url(&url("http://localhost:5173/"), Some(&dev)));
        assert!(is_app_url(
            &url("http://localhost:5173/index.html?print=1"),
            Some(&dev)
        ));
        assert!(!is_app_url(
            &url("http://localhost:5173/notes.md"),
            Some(&dev)
        ));
        assert!(!is_app_url(&url("http://localhost:5173/"), None));
        assert!(!is_app_url(&url("http://localhost:8080/"), Some(&dev)));
    }

    #[test]
    fn blocks_everything_else() {
        let dev = url("http://localhost:5173");
        for target in [
            "https://example.org/x",
            "http://tauri.localhost.example.org/",
            "tauri://example.org/",
            "file:///etc/passwd",
            "mailto:someone@example.org",
            "javascript:alert(1)",
            "about:blank",
            "about:srcdoc",
            "tauri://localhost/notes.md",
            "http://tauri.localhost/docs/x.md",
            "https://tauri.localhost/index.html/../x.md",
        ] {
            assert!(!is_app_url(&url(target), Some(&dev)), "{target}");
        }
    }
}
