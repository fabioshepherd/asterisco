//! The native application menu — **macOS only**.
//!
//! On macOS the menu bar belongs to the OS, so a native menu is the only way to
//! have one, and `lib.rs` attaches it there and nowhere else. On Windows/Linux
//! the window is frameless and `src/app/chrome/AppMenubar` draws the app menu in
//! the DOM instead.
//!
//! The builders below stay compiled on every platform so their unit tests run in
//! CI on Linux; off macOS nothing calls them, hence the scoped `dead_code` allow.
#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use tauri::menu::{AboutMetadata, Menu, MenuEvent, MenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, Runtime};

/// A node in the localized menu spec the frontend pushes via [`set_app_menu`].
/// Mirrors the TypeScript `SpecNode` (`src/lib/tauri/menu-spec.ts`); the `kind`
/// tag and camelCase variants keep the two in sync.
#[derive(serde::Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SpecNode {
    Command {
        id: String,
        label: String,
        accelerator: Option<String>,
    },
    Predefined {
        role: String,
    },
    Submenu {
        // Part of the wire contract with the frontend; the native builder keys
        // off label + children, so the id is unused server-side.
        #[allow(dead_code)]
        id: String,
        label: String,
        children: Vec<SpecNode>,
    },
    Separator,
}

/// A top-level menu section. An empty `label` (the app menu) falls back to
/// the built-in product name.
#[derive(serde::Deserialize)]
pub struct SpecSection {
    // Part of the wire contract with the frontend and asserted in tests; the
    // native builder keys off label + children, so the id is unused server-side.
    #[allow(dead_code)]
    pub id: String,
    pub label: String,
    pub children: Vec<SpecNode>,
}

/// Native predefined menu items. Parsed from the spec's `role` string so the
/// backend stays agnostic of the TypeScript model's shape.
#[derive(Clone, Copy)]
pub enum PredefinedRole {
    About,
    Services,
    Hide,
    HideOthers,
    ShowAll,
    Quit,
    Undo,
    Redo,
    Cut,
    Copy,
    Paste,
    SelectAll,
    Fullscreen,
    Minimize,
    Maximize,
    CloseWindow,
}

impl PredefinedRole {
    pub fn from_str(s: &str) -> Option<Self> {
        Some(match s {
            "about" => Self::About,
            "services" => Self::Services,
            "hide" => Self::Hide,
            "hideOthers" => Self::HideOthers,
            "showAll" => Self::ShowAll,
            "quit" => Self::Quit,
            "undo" => Self::Undo,
            "redo" => Self::Redo,
            "cut" => Self::Cut,
            "copy" => Self::Copy,
            "paste" => Self::Paste,
            "selectAll" => Self::SelectAll,
            "fullscreen" => Self::Fullscreen,
            "minimize" => Self::Minimize,
            "maximize" => Self::Maximize,
            "closeWindow" => Self::CloseWindow,
            _ => return None,
        })
    }
}

fn add_node<'m, R: Runtime, M: Manager<R>>(
    app: &'m M,
    b: SubmenuBuilder<'m, R, M>,
    node: &SpecNode,
) -> tauri::Result<SubmenuBuilder<'m, R, M>> {
    Ok(match node {
        SpecNode::Separator => b.separator(),
        SpecNode::Command {
            id,
            label,
            accelerator,
        } => {
            let item = MenuItem::with_id(app, id, label, true, accelerator.as_deref())?;
            b.item(&item)
        }
        SpecNode::Submenu {
            id: _,
            label,
            children,
        } => {
            let mut sb = SubmenuBuilder::new(app, label);
            for child in children {
                sb = add_node(app, sb, child)?;
            }
            b.item(&sb.build()?)
        }
        SpecNode::Predefined { role } => match PredefinedRole::from_str(role) {
            Some(PredefinedRole::About) => b.about(Some(AboutMetadata::default())),
            Some(PredefinedRole::Services) => b.services(),
            Some(PredefinedRole::Hide) => b.hide(),
            Some(PredefinedRole::HideOthers) => b.hide_others(),
            Some(PredefinedRole::ShowAll) => b.show_all(),
            Some(PredefinedRole::Quit) => b.quit(),
            Some(PredefinedRole::Undo) => b.undo(),
            Some(PredefinedRole::Redo) => b.redo(),
            Some(PredefinedRole::Cut) => b.cut(),
            Some(PredefinedRole::Copy) => b.copy(),
            Some(PredefinedRole::Paste) => b.paste(),
            Some(PredefinedRole::SelectAll) => b.select_all(),
            Some(PredefinedRole::Fullscreen) => b.fullscreen(),
            Some(PredefinedRole::Minimize) => b.minimize(),
            Some(PredefinedRole::Maximize) => b.maximize(),
            Some(PredefinedRole::CloseWindow) => b.close_window(),
            None => b, // unknown role: skip
        },
    })
}

/// Build the native application menu from a localized, platform-filtered spec.
/// Custom (id-carrying) items emit `menu://<id>` events the frontend listens
/// for; predefined items are handled natively.
pub fn build_menu_from_spec<R: Runtime>(
    app: &AppHandle<R>,
    spec: &[SpecSection],
) -> tauri::Result<Menu<R>> {
    let menu = Menu::new(app)?;
    for section in spec {
        // Empty app-section label → fall back to the product name.
        let title = if section.label.is_empty() {
            "Asterisco"
        } else {
            section.label.as_str()
        };
        let mut sb = SubmenuBuilder::new(app, title);
        for child in &section.children {
            sb = add_node(app, sb, child)?;
        }
        menu.append(&sb.build()?)?;
    }
    Ok(menu)
}

fn predefined(role: &str) -> SpecNode {
    SpecNode::Predefined { role: role.into() }
}

fn section(id: &str, label: &str, children: Vec<SpecNode>) -> SpecSection {
    SpecSection {
        id: id.into(),
        label: label.into(),
        children,
    }
}

/// The startup bridge: the smallest menu macOS needs during the few milliseconds
/// between window creation and the frontend pushing the real, localized menu via
/// [`set_app_menu`].
///
/// Deliberately **not** a mirror of `MENU_MODEL` (`src/app/menu/menu-model.ts`).
/// A second copy of the full menu drifts — the previous one already had: it was
/// missing `close-folder` and `edit-view`, and its View separators had diverged.
/// The frontend owns the menu; this owns only what cannot wait for it:
///
/// - **Edit roles.** On macOS the clipboard shortcuts are menu key-equivalents,
///   not webview behaviour: without an Edit menu carrying these roles, Cmd+C/V/X
///   do nothing at all.
/// - **About / Quit.** macOS expects an app menu to exist from the first frame.
///   `quit` here is the predefined role, which skips the unsaved-changes prompt
///   the `quit` *command* runs — harmless in the startup window, which has no
///   documents yet, and replaced as soon as the frontend pushes its spec.
///
/// Everything else (File, Format, View, Help, and every localized label) arrives
/// with that push. Labels here are English because there is nothing to localize
/// against yet; predefined roles are labelled by the OS anyway.
fn startup_spec() -> Vec<SpecSection> {
    vec![
        section("app", "", vec![predefined("about"), predefined("quit")]),
        section(
            "edit",
            "Edit",
            vec![
                predefined("undo"),
                predefined("redo"),
                SpecNode::Separator,
                predefined("cut"),
                predefined("copy"),
                predefined("paste"),
                predefined("selectAll"),
            ],
        ),
        section(
            "window",
            "Window",
            vec![predefined("minimize"), predefined("maximize")],
        ),
    ]
}

/// Build the startup menu (see [`startup_spec`]). The frontend replaces it with
/// the full localized menu immediately after mount via [`set_app_menu`].
pub fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    build_menu_from_spec(app, &startup_spec())
}

/// Rebuild the application menu from a localized spec and swap it in. Invoked
/// from the frontend on startup and whenever the UI language changes.
///
/// Off macOS this is a no-op: the DOM menubar is the app menu there, and the
/// backend refuses to install a native one whatever the frontend asks for. The
/// command stays registered on every platform so the wire contract — and the
/// frontend calling it — needs no platform branch of its own.
#[tauri::command]
pub fn set_app_menu(app: AppHandle, spec: Vec<SpecSection>) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let menu = build_menu_from_spec(&app, &spec)?;
        app.set_menu(menu)?;
    }
    #[cfg(not(target_os = "macos"))]
    let _ = (app, spec);
    Ok(())
}

/// Forward custom (id-carrying) menu activations to the frontend as `menu://<id>`.
/// Command ids are the canonical kebab-case ids from the command registry; the
/// frontend listens for exactly those. Predefined items are handled natively and
/// any event they emit carries an id no one listens for.
pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().0.as_str();
    let _ = app.emit(&format!("menu://{id}"), ());
}

#[cfg(test)]
mod tests {
    use super::{PredefinedRole, SpecNode, SpecSection};

    fn sample_spec() -> Vec<SpecSection> {
        vec![
            SpecSection {
                id: "app".into(),
                label: "App".into(),
                children: vec![],
            },
            SpecSection {
                id: "file".into(),
                label: "File".into(),
                children: vec![SpecNode::Command {
                    id: "new-file".into(),
                    label: "New".into(),
                    accelerator: Some("CmdOrCtrl+N".into()),
                }],
            },
        ]
    }

    #[test]
    fn builds_sections_from_spec_in_order() {
        let spec = sample_spec();
        let ids: Vec<&str> = spec.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["app", "file"]);
    }

    #[test]
    fn predefined_role_parses_known_and_rejects_unknown() {
        assert!(PredefinedRole::from_str("copy").is_some());
        assert!(PredefinedRole::from_str("fullscreen").is_some());
        assert!(PredefinedRole::from_str("nonsense").is_none());
    }

    #[test]
    fn startup_spec_is_the_minimal_macos_bridge() {
        let spec = super::startup_spec();
        let ids: Vec<&str> = spec.iter().map(|s| s.id.as_str()).collect();
        assert_eq!(ids, ["app", "edit", "window"]);
    }

    /// The startup spec exists to keep Cmd+C/V/X alive before the frontend
    /// pushes the real menu: on macOS those are menu key-equivalents, so losing
    /// the roles loses the shortcuts. Guards against a well-meaning trim.
    #[test]
    fn startup_spec_carries_every_clipboard_role() {
        let edit = super::startup_spec()
            .into_iter()
            .find(|s| s.id == "edit")
            .expect("startup spec has an Edit section");
        let roles: Vec<String> = edit
            .children
            .iter()
            .filter_map(|node| match node {
                SpecNode::Predefined { role } => Some(role.clone()),
                _ => None,
            })
            .collect();
        for role in ["undo", "redo", "cut", "copy", "paste", "selectAll"] {
            assert!(roles.contains(&role.to_string()), "missing role: {role}");
        }
    }

    /// The startup spec is a bridge, not a mirror of MENU_MODEL — the previous
    /// full copy had already drifted from it. Predefined roles only: anything
    /// carrying a label would need localizing, which is exactly what waiting for
    /// the frontend gives us.
    #[test]
    fn startup_spec_holds_predefined_roles_only() {
        for section in super::startup_spec() {
            for node in &section.children {
                assert!(
                    matches!(node, SpecNode::Predefined { .. } | SpecNode::Separator),
                    "startup spec must stay predefined-only, got a labelled node in {}",
                    section.id
                );
            }
        }
    }
}
