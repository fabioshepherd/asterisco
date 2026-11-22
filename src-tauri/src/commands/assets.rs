use std::fs::{File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

use crate::error::{AppError, AppResult};

/// Keep a sane, filesystem-safe file name (basename only, default extension).
fn sanitize_file_name(name: &str) -> String {
    let base = name.rsplit(['/', '\\']).next().unwrap_or(name);
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || matches!(c, '.' | '-' | '_') {
                c
            } else {
                '-'
            }
        })
        .collect();
    let cleaned = cleaned.trim_matches(['.', '-', '_']).to_string();
    let cleaned = if cleaned.is_empty() {
        "image".to_string()
    } else {
        cleaned
    };
    if Path::new(&cleaned).extension().is_some() {
        cleaned
    } else {
        format!("{cleaned}.png")
    }
}

/// Largest image accepted (25 MiB). The bytes cross IPC as one message, so
/// anything bigger is refused before it touches the disk. Mirrored by
/// `MAX_IMAGE_BYTES` in `src/editor/image-upload.ts`.
pub const MAX_IMAGE_BYTES: usize = 25 * 1024 * 1024;

/// Create a new file in `dir` for `file_name` that collides with nothing
/// (… , -1, -2 …) and return it with its path. The name is reserved by
/// creating the file (`create_new`), so two saves at once never pick the same
/// name and an existing file is never overwritten.
fn create_unique(dir: &Path, file_name: &str) -> AppResult<(PathBuf, File)> {
    let path = Path::new(file_name);
    let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("image");
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("png");
    let candidates = std::iter::once(file_name.to_string())
        .chain((1..10_000).map(|n| format!("{stem}-{n}.{ext}")));
    for name in candidates {
        let candidate = dir.join(name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => return Ok((candidate, file)),
            Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
            Err(e) => return Err(AppError::at(&candidate, e)),
        }
    }
    Err(AppError::AlreadyExists(
        dir.join(file_name).to_string_lossy().into_owned(),
    ))
}

/// Save an image next to a document in an `assets/` folder, returning the
/// relative link (`assets/<name>`) to store in the markdown. Portable: the link
/// stays valid wherever the document folder is moved. A write that fails part
/// way removes the file it had just created. The write is not atomic: a crash
/// mid-write can leave a truncated image under the new name, but never touches
/// an existing file.
#[tauri::command]
pub fn save_image_asset(doc_path: String, file_name: String, bytes: Vec<u8>) -> AppResult<String> {
    if bytes.len() > MAX_IMAGE_BYTES {
        return Err(AppError::ImageTooLarge(format!(
            "image is {} bytes; the limit is {MAX_IMAGE_BYTES}",
            bytes.len()
        )));
    }
    let doc = Path::new(&doc_path);
    let dir = doc
        .parent()
        .ok_or_else(|| AppError::NotFound(doc_path.clone()))?;
    let assets = dir.join("assets");
    std::fs::create_dir_all(&assets).map_err(|e| AppError::at(&assets, e))?;

    let safe = sanitize_file_name(&file_name);
    let (target, mut file) = create_unique(&assets, &safe)?;
    if let Err(e) = file.write_all(&bytes).and_then(|()| file.sync_all()) {
        drop(file);
        // Only the file this call created a moment ago: never a user's file.
        let _ = std::fs::remove_file(&target);
        return Err(AppError::at(&target, e));
    }

    let name = target
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("image.png");
    Ok(format!("assets/{name}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sanitizes_and_defaults_extension() {
        assert_eq!(sanitize_file_name("a b/c.png"), "c.png");
        assert_eq!(sanitize_file_name("weird name"), "weird-name.png");
        assert_eq!(sanitize_file_name(""), "image.png");
    }

    #[test]
    fn saves_into_assets_and_dedupes() {
        let dir = std::env::temp_dir().join(format!("asterisco_assets_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let doc = dir.join("note.md");
        std::fs::write(&doc, "# note").unwrap();

        let rel1 = save_image_asset(
            doc.to_string_lossy().into_owned(),
            "pic.png".into(),
            vec![1, 2, 3],
        )
        .unwrap();
        let rel2 = save_image_asset(
            doc.to_string_lossy().into_owned(),
            "pic.png".into(),
            vec![4, 5, 6],
        )
        .unwrap();

        assert_eq!(rel1, "assets/pic.png");
        assert_eq!(rel2, "assets/pic-1.png");
        assert!(dir.join("assets/pic.png").exists());
        assert!(dir.join("assets/pic-1.png").exists());

        std::fs::remove_dir_all(&dir).unwrap();
    }

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("asterisco_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn never_overwrites_a_file_that_appears_under_the_chosen_name() {
        let dir = scratch("assets_race");
        // Reserving a name creates the file, so a second reservation (a second
        // paste in the same frame) cannot pick the same one.
        let (first, _) = create_unique(&dir, "pic.png").unwrap();
        let (second, _) = create_unique(&dir, "pic.png").unwrap();
        assert_eq!(first, dir.join("pic.png"));
        assert_eq!(second, dir.join("pic-1.png"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn rejects_an_image_over_the_size_limit() {
        let dir = scratch("assets_limit");
        let doc = dir.join("note.md");
        let error = save_image_asset(
            doc.to_string_lossy().into_owned(),
            "big.png".into(),
            vec![0; MAX_IMAGE_BYTES + 1],
        )
        .unwrap_err();
        assert!(matches!(error, AppError::ImageTooLarge(_)), "{error:?}");
        assert_eq!(
            serde_json::to_value(&error).unwrap()["kind"],
            "imageTooLarge"
        );
        assert!(!dir.join("assets").exists(), "nothing is written");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_failure_names_the_path() {
        let dir = scratch("assets_fail");
        // `assets` is a file, so the folder cannot be created.
        std::fs::write(dir.join("assets"), "").unwrap();
        let error = save_image_asset(
            dir.join("note.md").to_string_lossy().into_owned(),
            "pic.png".into(),
            vec![1],
        )
        .unwrap_err();
        let value = serde_json::to_value(&error).unwrap();
        assert_eq!(value["path"], dir.join("assets").to_string_lossy().as_ref());
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
