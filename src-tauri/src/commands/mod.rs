pub mod assets;
pub mod fs;
pub mod open_with;
pub mod print;
pub mod search;
pub mod themes;
pub mod watcher;
pub mod workspace;

// Commands that touch the disk in proportion to the user's data — reading or
// saving a document, listing a folder, walking the workspace, trashing — are
// declared `#[tauri::command(async)]`. A plain `#[tauri::command]` runs on the
// main thread (https://v2.tauri.app/develop/calling-rust/#async-commands), so a
// search over a large repository or a save to a slow volume froze the whole
// window, title bar included. `(async)` keeps the function synchronous and the
// invoke contract identical; only the thread it runs on changes.

#[cfg(test)]
mod tests {
    /// The attribute is one token and easy to drop in a refactor; nothing else
    /// would notice until a large workspace froze the window again.
    #[test]
    fn blocking_file_commands_stay_off_the_main_thread() {
        let sources = [
            (include_str!("fs.rs"), "read_text_file"),
            (include_str!("fs.rs"), "write_text_file"),
            (include_str!("fs.rs"), "read_dir"),
            (include_str!("fs.rs"), "move_to_trash"),
            (include_str!("workspace.rs"), "list_markdown_files"),
            (include_str!("search.rs"), "search_workspace"),
        ];
        for (source, name) in sources {
            // A Windows checkout may carry CRLF line endings.
            let source = source.replace("\r\n", "\n");
            let declaration = format!("#[tauri::command(async)]\npub fn {name}(");
            assert!(
                source.contains(&declaration),
                "`{name}` must be declared #[tauri::command(async)]"
            );
        }
    }
}
