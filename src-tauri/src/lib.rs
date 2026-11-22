mod commands;
mod error;
mod fs_policy;
mod menu;
mod navigation;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Verbose logs in dev builds, quieter (Info) in release bundles.
    let log_level = if cfg!(debug_assertions) {
        tauri_plugin_log::log::LevelFilter::Debug
    } else {
        tauri_plugin_log::log::LevelFilter::Info
    };

    let builder = tauri::Builder::default();

    // Single instance first, as the plugin requires. Without it a second
    // double-click in Finder/Explorer would start a whole second app instead of
    // opening the file in the window the user already has: the file would open,
    // but in the wrong process, with its own tabs and its own unsaved state.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        commands::open_with::focus_main(app);
        commands::open_with::queue(
            app,
            commands::open_with::paths_from_args(args, std::path::Path::new(&cwd)),
        );
    }));

    let builder = builder
        // Links never navigate the app window away (see navigation.rs).
        .plugin(navigation::guard())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log_level)
                .targets([
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    // Rotating, app-named file in the OS-specific log directory.
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("asterisco".into()),
                    }),
                ])
                .build(),
        )
        .setup(|app| {
            // The updater is desktop-only; mobile has no self-update.
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            // macOS: the overlay title bar + hidden native title are set at window
            // creation via tauri.conf.json (titleBarStyle: Overlay, hiddenTitle), so
            // the traffic lights float over our custom title strip
            // (see src/app/chrome/MacTitleStrip) without the native title text
            // overlapping the tab bar. Nothing to do at runtime.

            // Windows/Linux: frameless window; the custom React title bar
            // (src/app/chrome/TitleBar) draws the menu and window controls.
            #[cfg(not(target_os = "macos"))]
            {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_decorations(false);
                }
            }

            // A file passed on the command line (Windows/Linux file
            // associations, or `asterisco README.md` from a shell). macOS routes
            // Finder opens through RunEvent::Opened below instead.
            commands::open_with::queue_launch_args(app.handle());

            let _ = app;
            Ok(())
        })
        .manage(commands::open_with::PendingFiles::default())
        .manage(commands::watcher::WatcherState::default())
        .manage(commands::watcher::SelfWriteState::default())
        .manage(commands::themes::ThemesWatcherState::default());

    // The application menu is macOS-only. There the menu bar belongs to the OS,
    // so it is the only way to have one. On Windows/Linux the window is frameless
    // and the React menubar (src/app/chrome/AppMenubar) is the app menu: attaching
    // a native menu there would draw a second menu bar (GTK packs it into the
    // window) and, worse, register its accelerators app-wide, where they silently
    // outrank the customizable in-app keymap.
    #[cfg(target_os = "macos")]
    let builder = builder
        .menu(menu::build_menu)
        .on_menu_event(menu::handle_menu_event);

    builder
        .invoke_handler(tauri::generate_handler![
            commands::fs::read_text_file,
            commands::fs::write_text_file,
            commands::fs::path_exists,
            commands::fs::read_dir,
            commands::fs::move_to_trash,
            commands::fs::create_file,
            commands::fs::rename_path,
            commands::fs::read_third_party_notices,
            commands::workspace::list_markdown_files,
            commands::workspace::find_project_root,
            commands::search::search_workspace,
            commands::assets::save_image_asset,
            commands::watcher::start_watch,
            commands::watcher::stop_watch,
            commands::themes::ensure_themes_dir,
            commands::themes::start_themes_watch,
            commands::themes::stop_themes_watch,
            commands::open_with::take_pending_files,
            commands::print::open_print_window,
            menu::set_app_menu,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS hands Finder/"Open with" files to the running app as an
            // event, not on argv — including for a cold launch, where it arrives
            // right after setup.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = &event {
                let paths = urls
                    .iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .collect();
                commands::open_with::queue(app, paths);
            }
            let _ = (app, event);
        });
}
