import { useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import { COMMANDS } from "@/app/menu/commands";
import { menuEventName } from "@/app/menu/event-names";

/**
 * Bridge native menu events (emitted from Rust as `menu://<id>`) into the app.
 * Each command in the registry maps to a `menu://<id>` channel; the native menu
 * items carry their accelerators, so we don't register key handlers here.
 */
export function useMenuEvents(): void {
  useEffect(() => {
    if (!isTauri()) return;

    const subs: Promise<UnlistenFn>[] = Object.values(COMMANDS).map((cmd) =>
      listen(menuEventName(cmd.id), () => void cmd.run()),
    );

    return () => {
      for (const pending of subs) void pending.then((un) => un());
    };
  }, []);
}
