/**
 * In-memory stand-in for the Tauri IPC bridge, injected with `page.addInitScript`
 * before the app bundle runs. It builds the same globals `mockIPC` from
 * `@tauri-apps/api/mocks` builds (`__TAURI_INTERNALS__`, the event-plugin
 * internals) plus `isTauri` and the OS-plugin constants, so the production bundle
 * takes its Tauri code paths without any test hook inside the app.
 *
 * `installTauriMock` is serialized by Playwright and runs in the page, so it must
 * stay self-contained: no imports, no references to module scope.
 */

export interface MockSeed {
  /** Absolute path -> file contents. Directories are derived from the paths. */
  files: Record<string, string>;
  /** Initial contents of the plugin-store `settings.json`. */
  store: Record<string, unknown>;
  /** Paths returned once by `take_pending_files` (an OS "open with" launch). */
  pendingFiles: string[];
  /** Answers for `plugin:dialog|save`, consumed in order (`null` = cancelled). */
  saveDialog: (string | null)[];
  /** What `plugin:os|locale` reports. */
  locale: string;
}

export interface MockWrite {
  path: string;
  contents: string;
}

export interface MockState {
  files: Record<string, string>;
  writes: MockWrite[];
  /** Commands the app sent that this mock does not know (each also rejects). */
  unmocked: string[];
  /** URLs handed to the opener plugin (the system browser). */
  openedUrls: string[];
}

export function installTauriMock(seed: MockSeed): void {
  type Args = Record<string, unknown>;
  type Callback = (payload: unknown) => void;

  const state: MockState = {
    files: { ...seed.files },
    writes: [],
    unmocked: [],
    openedUrls: [],
  };
  const store = new Map<string, unknown>(Object.entries(seed.store));
  const pending = [...seed.pendingFiles];
  const saveAnswers = [...seed.saveDialog];
  const callbacks = new Map<number, Callback>();
  let nextCallbackId = 1;

  const baseName = (path: string): string => path.split("/").pop() ?? path;
  const isDir = (path: string): boolean => {
    const prefix = path.endsWith("/") ? path : `${path}/`;
    return Object.keys(state.files).some((file) => file.startsWith(prefix));
  };

  const searchWorkspace = (args: Args) => {
    const root = String(args.root);
    const caseSensitive = Boolean(args.caseSensitive);
    const needle = caseSensitive ? String(args.query) : String(args.query).toLowerCase();
    const files = Object.entries(state.files)
      .filter(([path]) => path.startsWith(`${root}/`) && /\.(md|markdown)$/i.test(path))
      .map(([path, content]) => {
        const matches = content.split(/\r?\n/).flatMap((line, index) => {
          const hay = caseSensitive ? line : line.toLowerCase();
          const at = hay.indexOf(needle);
          return at < 0 ? [] : [{ line: index + 1, column: at + 1, text: line.trim() }];
        });
        return { name: path.slice(root.length + 1), path, matches };
      })
      .filter((file) => file.matches.length > 0);
    return { files, truncated: false };
  };

  const readDir = (args: Args) => {
    const dir = String(args.path).replace(/\/$/, "");
    const children = new Map<string, boolean>();
    for (const file of Object.keys(state.files)) {
      if (!file.startsWith(`${dir}/`)) continue;
      const [first, ...rest] = file.slice(dir.length + 1).split("/");
      if (first) children.set(first, (children.get(first) ?? false) || rest.length > 0);
    }
    const entries = [...children.entries()]
      .map(([name, dirEntry]) => ({ name, path: `${dir}/${name}`, isDir: dirEntry }))
      .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
    return { entries, total: entries.length, scanned: entries.length };
  };

  const handlers: Record<string, (args: Args) => unknown> = {
    // App commands (src-tauri/src/commands).
    read_text_file: (args) => {
      const path = String(args.path);
      if (!(path in state.files)) throw new Error(`not found: ${path}`);
      return state.files[path];
    },
    write_text_file: (args) => {
      const write = { path: String(args.path), contents: String(args.contents) };
      state.files[write.path] = write.contents;
      state.writes.push(write);
      return null;
    },
    path_exists: (args) => String(args.path) in state.files || isDir(String(args.path)),
    read_dir: readDir,
    list_markdown_files: (args) => {
      const root = String(args.root);
      const files = Object.keys(state.files)
        .filter((path) => path.startsWith(`${root}/`) && /\.(md|markdown)$/i.test(path))
        .map((path) => ({ name: baseName(path), path }));
      return { files, truncated: false, skipped: 0 };
    },
    find_project_root: () => null,
    search_workspace: searchWorkspace,
    take_pending_files: () => pending.splice(0),
    set_app_menu: () => null,
    start_watch: () => null,
    stop_watch: () => null,
    start_themes_watch: () => null,
    stop_themes_watch: () => null,
    ensure_themes_dir: () => "/mock/themes",
    // Plugins.
    "plugin:store|load": () => 1,
    "plugin:store|get_store": () => 1,
    "plugin:store|get": (args) => {
      const key = String(args.key);
      return [store.get(key) ?? null, store.has(key)];
    },
    "plugin:store|set": (args) => {
      store.set(String(args.key), args.value);
      return null;
    },
    "plugin:store|delete": (args) => store.delete(String(args.key)),
    "plugin:store|has": (args) => store.has(String(args.key)),
    "plugin:store|save": () => null,
    "plugin:os|locale": () => seed.locale,
    "plugin:app|version": () => "1.0.0",
    // No update available: the About check settles on "You’re on the latest version".
    "plugin:updater|check": () => null,
    "plugin:opener|open_url": (args) => {
      state.openedUrls.push(String(args.url));
      return null;
    },
    "plugin:dialog|save": () => saveAnswers.shift() ?? null,
    "plugin:dialog|open": () => null,
    "plugin:log|log": () => null,
    "plugin:resources|close": () => null,
    "plugin:event|listen": (args) => args.handler,
    "plugin:event|unlisten": () => null,
    "plugin:event|emit": () => null,
    "plugin:window|is_fullscreen": () => false,
    "plugin:window|is_maximized": () => false,
    "plugin:window|set_fullscreen": () => null,
  };

  const page = window as unknown as Record<string, unknown>;
  page.isTauri = true;
  page.__tauriMock = state;
  page.__TAURI_OS_PLUGIN_INTERNALS__ = {
    platform: "linux",
    os: "linux",
    family: "unix",
    arch: "x86_64",
    eol: "\n",
    exe: "",
    version: "0",
  };
  page.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined };
  page.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    },
    plugins: {},
    invoke: (cmd: string, args: Args = {}) => {
      const handler = handlers[cmd];
      if (!handler) {
        state.unmocked.push(cmd);
        return Promise.reject(new Error(`unmocked: ${cmd}`));
      }
      try {
        return Promise.resolve(handler(args));
      } catch (error) {
        // Real Tauri commands reject with the serialized Rust error (a string),
        // which is what the app's error localization expects.
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        return Promise.reject(error instanceof Error ? error.message : String(error));
      }
    },
    transformCallback: (callback?: Callback, once = false) => {
      const id = nextCallbackId++;
      callbacks.set(id, (payload) => {
        if (once) callbacks.delete(id);
        callback?.(payload);
      });
      return id;
    },
    unregisterCallback: (id: number) => callbacks.delete(id),
    runCallback: (id: number, payload: unknown) => callbacks.get(id)?.(payload),
    callbacks,
    convertFileSrc: (path: string, protocol = "asset") =>
      `${protocol}://localhost/${encodeURIComponent(path)}`,
  };
}
