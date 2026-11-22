# Contributing

Thanks for your interest — contributions are welcome. This guide is how we
work. Everyone taking part is expected to follow the
[Code of Conduct](./CODE_OF_CONDUCT.md).

## Licence

Asterisco is licensed under the [MIT licence](./LICENSE). Contributions follow
the same terms (_inbound = outbound_): by opening a pull request you agree that
your contribution ships under the MIT licence. There is no CLA to sign.

## Before you start

Read these first — they are the source of truth for scope and conventions:

- [PRODUCT.md](./PRODUCT.md) — who the product is for, what it claims, and what
  it refuses to become.
- [docs/ROADMAP.md](./docs/ROADMAP.md) — phase status and what is planned.
- [CLAUDE.md](./CLAUDE.md) — the lean brief on stack, layout and rules. It is
  written for anyone working on the code, people and coding agents alike; keep
  personal agent preferences in an untracked `CLAUDE.local.md`.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the app is put together.
- [DESIGN.md](./DESIGN.md) and [docs/THEMING.md](./docs/THEMING.md) — the visual
  system, for any UI change.

For anything bigger than a small fix, **open an issue first** (a bug report or
a feature proposal) so we can agree on the approach before you write code.
Proposals that go against `PRODUCT.md` (for example cloud features that send
data off the device by default) will be declined, however well built.

**Security issues are never reported in public issues** — see
[SECURITY.md](./SECURITY.md).

## Local setup

Prerequisites:

- [bun](https://bun.sh) ≥ 1.3 (package manager)
- Node ≥ 20.19 or ≥ 22.12 (used by some tooling)
- [Rust](https://rustup.rs) (stable) + Cargo
- The [Tauri 2 system prerequisites](https://v2.tauri.app/start/prerequisites/)
  for your OS (on macOS, the Xcode Command Line Tools:
  `xcode-select --install`; on Linux, the WebKitGTK development packages)

```bash
bun install
bun tauri dev
```

## Checks

| Command | What it does |
| --- | --- |
| `bun tauri dev` | Run the desktop app in development |
| `bun run typecheck` | `tsc -b --noEmit`: app, Node config and e2e projects (strict) |
| `bun run lint` | ESLint + Prettier check (`bun run lint:fix` to autofix) |
| `bun run test` | Vitest (unit + component) |
| `bun run test:e2e` | Playwright end-to-end tests (first run: `bunx playwright install chromium`) |

When you change Rust code (`src-tauri/`), also run:

```bash
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings && \
cargo test --manifest-path src-tauri/Cargo.toml && \
cargo fmt --manifest-path src-tauri/Cargo.toml
```

Run the checks before every commit. CI runs the same jobs on each pull request
(`frontend`, `e2e`, `rust`, and the `bundle` packaging build) and all of them
must pass before a merge.

## Code conventions

- **TypeScript strict**; avoid `any` (justify with a comment if unavoidable).
- Functional components + hooks; small, single-responsibility components;
  **feature-based structure** under `src/features`.
- **All filesystem / native I/O goes through Rust commands** in
  `src-tauri/src/commands`. The frontend never touches the filesystem directly.
- **All UI strings via i18n, in both Italian and English** (`src/i18n/locales`)
  — never hardcoded. If you cannot write one of the two languages, say so in the
  pull request and we will help.
- **All colors via design tokens / CSS variables** and **all fonts via the
  typography tokens** — every component must work in light and dark mode.
- **Accessibility (WCAG 2.2 AA):** full keyboard navigation, visible focus,
  correct ARIA on custom UI, enough contrast in every theme.
- **Local-first:** no network calls unless strictly required; anything that
  would send data off the device must be opt-in.
- English for code, comments, commit messages and pull requests.
- Write tests for core logic and critical components.

See [CLAUDE.md](./CLAUDE.md) for the full set of rules and the definition of
done.

## Dependencies

Add a dependency only when it is clearly worth it, and say why in the pull
request. Every dependency must have a licence compatible with MIT
redistribution (MIT, Apache-2.0, BSD, ISC and similar). **Avoid copyleft
libraries (GPL, AGPL)** unless the maintainer approves them first: they would
force the whole project to change licence. The release build bundles the licence
texts of all dependencies in `THIRD-PARTY-NOTICES`.

Always read the current official docs of a library before using its API — the
stack moves fast.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/)
  (`feat:`, `fix:`, `docs:`, `ci:`, `chore:` …), one logical change per commit.
- Branch from `main` and open the pull request against `main`. Keep it focused:
  one topic per pull request. Open it as a draft while it is still in progress.
- Fill in the pull request template: what changes, why, how you tested it, and
  screenshots for UI changes (light and dark).
- New or changed user-facing text needs both `it` and `en` strings.
- A maintainer reviews every pull request; merges happen only with all CI
  checks green.

Thanks for helping make Asterisco better.
