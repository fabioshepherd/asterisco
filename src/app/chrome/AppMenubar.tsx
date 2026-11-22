import { useEffect, type ReactNode } from "react";
import { Menu as MenuIcon, SquarePen } from "lucide-react";
import { useTranslation } from "react-i18next";

import { COMMANDS } from "@/app/menu/commands";
import {
  MENU_MODEL,
  type MenuNode,
  type Platform,
  type PredefinedRole,
} from "@/app/menu/menu-model";
import { currentPlatform } from "@/app/platform";
import {
  copy as editCopy,
  cut as editCut,
  paste as editPaste,
  redo as editRedo,
  selectAll as editSelectAll,
  undo as editUndo,
  trackEditableFocus,
} from "@/editor/edit-commands";
import { commandCombo, formatCombo, useKeybindings } from "@/features/settings/keybindings";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { focusOrigin, returnFocus } from "@/lib/focus-return";
import { minimizeWindow, toggleMaximizeWindow, toggleWindowFullscreen } from "@/lib/tauri/window";

import { useMenubarCollapse } from "./use-menubar-collapse";

type Translate = (key: string) => string;

type RenderedNode =
  | { kind: "separator"; key: string }
  | { kind: "item"; key: string; label: string; shortcut?: string; onSelect: () => void }
  | { kind: "submenu"; key: string; label: string; children: RenderedNode[] };

/**
 * Predefined roles rendered on Windows/Linux. On macOS these are native menu
 * items the OS draws and handles; here each one needs a real implementation,
 * because with the native menu gated to macOS nothing else carries them.
 *
 * The edit roles go through {@link "@/editor/edit-commands"}, which routes them
 * to whichever surface last held the caret. The Ctrl shortcuts still work on
 * their own — these items are the discoverable path to the same actions, and the
 * place a user looks to learn the shortcut.
 *
 * macOS-only roles (services/hide/hideOthers/showAll) never reach this function:
 * the menu model filters them by `platforms`.
 */
function predefinedItem(role: PredefinedRole, t: Translate): RenderedNode | null {
  const item = (key: string, label: string, onSelect: () => void): RenderedNode => ({
    kind: "item",
    key: `predef-${key}`,
    label,
    onSelect,
  });

  switch (role) {
    case "undo":
      return item("undo", t("edit.undo"), editUndo);
    case "redo":
      return item("redo", t("edit.redo"), editRedo);
    case "cut":
      return item("cut", t("edit.cut"), editCut);
    case "copy":
      return item("copy", t("edit.copy"), editCopy);
    case "paste":
      return item("paste", t("edit.paste"), editPaste);
    case "selectAll":
      return item("select-all", t("edit.selectAll"), editSelectAll);
    case "fullscreen":
      return item("fullscreen", t("view.fullscreen"), () => void toggleWindowFullscreen());
    case "minimize":
      return item("minimize", t("window.controls.minimize"), () => void minimizeWindow());
    case "maximize":
      return item("maximize", t("window.controls.maximize"), () => void toggleMaximizeWindow());
    // `about` is no longer in the menu model (the app's own About panel is the
    // `about` command); the role stays only in Rust's startup menu on macOS.
    case "about":
      return null;
    default:
      return null;
  }
}

/** Drop leading/trailing and collapse consecutive separators left by filtering. */
function cleanSeparators(items: RenderedNode[]): RenderedNode[] {
  const result: RenderedNode[] = [];
  for (const item of items) {
    if (
      item.kind === "separator" &&
      (result.length === 0 || result[result.length - 1]?.kind === "separator")
    ) {
      continue;
    }
    result.push(item);
  }
  while (result.length > 0 && result[result.length - 1]?.kind === "separator") result.pop();
  return result;
}

function buildNodes(
  nodes: MenuNode[],
  target: Platform,
  t: Translate,
  bindings: Record<string, string>,
): RenderedNode[] {
  const out: RenderedNode[] = [];
  for (const node of nodes) {
    switch (node.kind) {
      case "separator":
        out.push({ kind: "separator", key: `sep-${out.length}` });
        break;
      case "predefined": {
        if (node.platforms && !node.platforms.includes(target)) break;
        const item = predefinedItem(node.role, t);
        if (item) out.push(item);
        break;
      }
      case "command": {
        if (node.platforms && !node.platforms.includes(target)) break;
        const def = COMMANDS[node.command];
        // Every hint is a key that fires here: Format combos run in the editor
        // keymap, the rest in the window keymap (`use-global-shortcuts`).
        const combo = commandCombo(node.command, bindings);
        out.push({
          kind: "item",
          key: node.command,
          label: t(def.labelKey),
          shortcut: combo ? formatCombo(combo) : undefined,
          onSelect: () => void COMMANDS[node.command].run(),
        });
        break;
      }
      case "submenu":
        out.push({
          kind: "submenu",
          key: node.id,
          label: t(node.labelKey),
          children: buildNodes(node.children, target, t, bindings),
        });
        break;
    }
  }
  return cleanSeparators(out);
}

function renderNodes(nodes: RenderedNode[]): ReactNode {
  return nodes.map((node) => {
    if (node.kind === "separator") return <MenubarSeparator key={node.key} />;
    if (node.kind === "submenu") {
      return (
        <MenubarSub key={node.key}>
          <MenubarSubTrigger>{node.label}</MenubarSubTrigger>
          <MenubarSubContent>{renderNodes(node.children)}</MenubarSubContent>
        </MenubarSub>
      );
    }
    return (
      <MenubarItem key={node.key} onSelect={node.onSelect}>
        <span>{node.label}</span>
        {node.shortcut ? <MenubarShortcut>{node.shortcut}</MenubarShortcut> : null}
      </MenubarItem>
    );
  });
}

function menubarElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="menubar"]');
}

function focusFirstTrigger(): void {
  menubarElement()?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
}

/**
 * Windows menu keyboard conventions: F10 and a lone Alt tap focus the menubar;
 * Esc on a focused trigger (no menu open) hands focus back to where it was
 * before F10/Alt — the tree row, the tab, the editor — falling back to the
 * visible editor (Source view included) when that element is gone. Radix
 * already provides arrow / Enter / type-ahead within an open menu. Co-located
 * with the menubar so it only listens while the Windows/Linux chrome is mounted.
 */
function useMenubarKeyboardAccess(): void {
  useEffect(() => {
    let altTap = false;
    // Where focus was before the keyboard entered the menubar.
    let origin: HTMLElement | null = null;
    const enterMenubar = () => {
      if (!document.activeElement?.closest('[role="menubar"]')) origin = focusOrigin();
      focusFirstTrigger();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "F10" && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
        event.preventDefault();
        enterMenubar();
        return;
      }
      if (event.key === "Alt") {
        altTap = true;
        return;
      }
      altTap = false;
      const menubar = menubarElement();
      if (event.key === "Escape" && menubar?.contains(document.activeElement)) {
        // Focus is on a trigger (open menus live in a portal outside the menubar),
        // so leave the menubar.
        returnFocus(origin, menubar);
        origin = null;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Alt" && altTap) {
        altTap = false;
        if (!document.activeElement?.closest('[role="menubar"]')) enterMenubar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
}

/**
 * The Windows/Linux application menu, rendered from {@link MENU_MODEL} into a
 * Radix Menubar. Each `command` node invokes the shared command registry. When
 * the window is narrow the whole tree collapses into a single `☰` overflow.
 */
export function AppMenubar() {
  // labelKeys come from the menu model; the typed `t` can't see they're valid.
  const t = useTranslation("menu").t as unknown as Translate;
  const target = currentPlatform();
  const collapsed = useMenubarCollapse();
  const bindings = useKeybindings((state) => state.bindings);
  useMenubarKeyboardAccess();
  // Opening a menu takes focus away from the editor, so the Edit items need to
  // know where the caret was before that happened. Tracked only while this
  // menubar is mounted — on macOS the OS handles those roles itself.
  useEffect(trackEditableFocus, []);

  const sections = MENU_MODEL.map((section) => ({
    id: section.id,
    label: section.labelKey ? t(section.labelKey) : t("app.name"),
    nodes: buildNodes(section.children, target, t, bindings),
  })).filter((section) => section.nodes.length > 0);

  if (collapsed) {
    return (
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger aria-label={t("menubar.open")}>
            <MenuIcon className="size-4" />
          </MenubarTrigger>
          <MenubarContent>
            {sections.map((section) => (
              <MenubarSub key={section.id}>
                <MenubarSubTrigger>{section.label}</MenubarSubTrigger>
                <MenubarSubContent>{renderNodes(section.nodes)}</MenubarSubContent>
              </MenubarSub>
            ))}
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
  }

  return (
    <Menubar>
      {sections.map((section) => (
        <MenubarMenu key={section.id}>
          <MenubarTrigger aria-label={section.id === "app" ? section.label : undefined}>
            {section.id === "app" ? <SquarePen className="size-4" /> : section.label}
          </MenubarTrigger>
          <MenubarContent>{renderNodes(section.nodes)}</MenubarContent>
        </MenubarMenu>
      ))}
    </Menubar>
  );
}
