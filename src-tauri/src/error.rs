use std::path::Path;

use serde::Serialize;

/// Application error returned by Tauri commands. Serialized into a tagged union
/// that the frontend narrows on (see src/lib/tauri/errors.ts).
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// An I/O failure together with the path it happened on.
    ///
    /// `std::io::Error` carries an errno and no path, so a bare `?` produces
    /// "Permission denied (os error 13)" with nothing to point at. Anything the
    /// user can name — a folder they asked to open, a file they asked to save —
    /// should say *what* failed, not only that something did. There is no
    /// path-less I/O variant and no `From<std::io::Error>`, so a bare `?` on an
    /// I/O call does not compile: wrap it with [`AppError::at`].
    #[error("io error at {path}: {source}")]
    IoAt {
        path: String,
        source: std::io::Error,
    },
    #[error("path not found: {0}")]
    NotFound(String),
    #[error("path already exists: {0}")]
    AlreadyExists(String),
    #[error("trash error: {0}")]
    Trash(String),
    #[error("watch error: {0}")]
    Watch(String),
    #[error("resource error: {0}")]
    Resource(String),
    /// A pasted or dropped image over the size limit; the message gives the sizes.
    #[error("image too large: {0}")]
    ImageTooLarge(String),
}

impl AppError {
    /// Attach the path an I/O call failed on.
    pub fn at(path: impl AsRef<Path>, source: std::io::Error) -> Self {
        AppError::IoAt {
            path: path.as_ref().to_string_lossy().into_owned(),
            source,
        }
    }
}

/// The frontend-facing name for an OS error.
///
/// The errno is the only thing that says *why*, and collapsing every variant
/// into one "io" bucket threw that away — the UI could then only manage a single
/// sentence for every failure on disk. The kinds named here have a phrase of
/// their own; everything else stays `io` and carries the raw OS text.
fn io_kind(error: &std::io::Error) -> &'static str {
    use std::io::ErrorKind;
    match error.kind() {
        ErrorKind::NotFound => "notFound",
        ErrorKind::PermissionDenied => "permissionDenied",
        ErrorKind::AlreadyExists => "alreadyExists",
        ErrorKind::NotADirectory => "notADirectory",
        _ => "io",
    }
}

/// The wire shape: `{ kind, message, path? }`.
///
/// `message` is the raw, untranslated OS text on purpose. The UI localizes
/// `kind`; `message` is what a log line and a bug report need, and it is the
/// only thing that survives an errno the list above does not name.
#[derive(Serialize)]
struct SerializedError<'a> {
    kind: &'a str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    path: Option<&'a str>,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let serialized = match self {
            AppError::IoAt { path, source } => SerializedError {
                kind: io_kind(source),
                message: source.to_string(),
                path: Some(path),
            },
            AppError::NotFound(path) => SerializedError {
                kind: "notFound",
                message: path.clone(),
                path: Some(path),
            },
            AppError::AlreadyExists(path) => SerializedError {
                kind: "alreadyExists",
                message: path.clone(),
                path: Some(path),
            },
            AppError::Trash(message) => SerializedError {
                kind: "trash",
                message: message.clone(),
                path: None,
            },
            AppError::Watch(message) => SerializedError {
                kind: "watch",
                message: message.clone(),
                path: None,
            },
            AppError::Resource(message) => SerializedError {
                kind: "resource",
                message: message.clone(),
                path: None,
            },
            AppError::ImageTooLarge(message) => SerializedError {
                kind: "imageTooLarge",
                message: message.clone(),
                path: None,
            },
        };
        serialized.serialize(serializer)
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    fn json(error: AppError) -> serde_json::Value {
        serde_json::to_value(error).unwrap()
    }

    /// The frontend narrows on `kind` and mirrors this list in
    /// `src/lib/tauri/errors.ts`; the phrase it shows depends on getting the
    /// errno-specific name rather than the generic one.
    #[test]
    fn an_os_error_reports_its_cause_and_its_path() {
        let denied = std::io::Error::from(std::io::ErrorKind::PermissionDenied);
        let value = json(AppError::at("/x/private", denied));
        assert_eq!(value["kind"], "permissionDenied");
        assert_eq!(value["path"], "/x/private");
        assert!(
            value["message"].as_str().unwrap().contains("denied"),
            "the raw OS text is what a log line needs: {value}"
        );

        let missing = AppError::at(
            "/x/gone",
            std::io::Error::from(std::io::ErrorKind::NotFound),
        );
        assert_eq!(json(missing)["kind"], "notFound");

        // An errno with no phrase of its own keeps the generic kind, and the
        // raw text is the only thing that can explain it.
        let other = AppError::at("/x/disk", std::io::Error::other("disk fell over"));
        let value = json(other);
        assert_eq!(value["kind"], "io");
        assert_eq!(value["message"], "disk fell over");
        assert_eq!(value["path"], "/x/disk");
    }

    #[test]
    fn the_wire_shape_is_still_kind_plus_message() {
        let value = json(AppError::NotFound("/gone.md".into()));
        assert_eq!(value["kind"], "notFound");
        assert_eq!(value["message"], "/gone.md");
        assert_eq!(value["path"], "/gone.md");
    }
}
