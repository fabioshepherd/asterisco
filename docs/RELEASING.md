# Releasing & code signing

Releases are built by GitHub Actions (`.github/workflows/release.yml`) when an
`app-v*` tag is pushed. **No secret is ever committed** — every key/credential is
read from the repository's encrypted secrets at build time. Signing is optional:
if a platform's secrets are absent, that platform ships **unsigned**.

## One-time setup

### 1. Updater signing keypair (required for auto-update)

The app ships with `bundle.createUpdaterArtifacts: true`, so every build signs its
update artifacts. Generate your own keypair and replace the placeholder public
key in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`):

```sh
bunx tauri signer generate -w ~/.tauri/asterisco.key
```

- Put the **public** key (`~/.tauri/asterisco.key.pub` contents) in
  `plugins.updater.pubkey`.
- Add the **private** key as the `TAURI_SIGNING_PRIVATE_KEY` repo secret (and
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` if you set a password).
- **Back the private key up.** If it is lost, existing installs can no longer
  receive updates.

> The committed `pubkey` is the project's own release key (minisign id
> `7E06AE5B898C6E12`); its private half lives only in the repository secrets.
> A fork that publishes its own builds must generate its own keypair and
> replace it. The release workflow's "Preflight - updater config" step refuses
> to build while the old development placeholder key is in place.

### 2. Update endpoint

`plugins.updater.endpoints` points at this repo's GitHub Releases:

```
https://github.com/fabioshepherd/asterisco/releases/latest/download/latest.json
```

`tauri-action` uploads `latest.json` to the release automatically. The release
must be **published** (not draft) for clients to download it — the workflow
creates a draft; publish it after verifying.

> The endpoint must match the repository's `owner/name`, or update checks get a
> 404. **If the repository is ever renamed or forked for releases**, update this
> endpoint to the new `owner/repo`. The release workflow's "Preflight - updater
> config" step fails the build if the original `OWNER/REPO` placeholder is ever
> reintroduced.

### 3. macOS code signing + notarization (optional)

> **The first build ships UNSIGNED on macOS — this is a deliberate, deferred
> decision.** Until the maintainer provisions an Apple Developer ID certificate
> and notarization credentials (the steps below), Gatekeeper quarantines the
> downloaded app and refuses the first open. What users do about it is in
> [What users see from an unsigned build](#what-users-see-from-an-unsigned-build).
> Provisioning Developer ID + notarization removes the warning; it is not
> required for the first release.

`release.yml` already carries the signing and notarization path; it stays off
until the repository variable `ENABLE_MAC_SIGNING` is `true`. Nothing in the
code or the workflow changes when signing is turned on.

1. **Join the Apple Developer Program** (paid, yearly; enrol as an individual
   with an Apple ID that has two-factor authentication). Only Apple issues
   Developer ID certificates; there is no free route.
2. **Create a Developer ID Application certificate** — this needs a Mac:
   - Keychain Access → Certificate Assistant → *Request a Certificate From a
     Certificate Authority…*, saved to disk.
   - developer.apple.com → Certificates → **+** → **Developer ID
     Application**, upload the request, download the `.cer` and open it.
   - In Keychain Access, export the certificate **with its private key** as a
     `.p12`, protected by a password, then copy it as base64:
     `base64 -i certificate.p12 | pbcopy`.
3. **Create the notarization credentials:** an app-specific password at
   appleid.apple.com (Sign-In and Security → App-Specific Passwords), and note
   the Team ID from developer.apple.com → Membership.
4. **Add the repository secrets** (Settings → Secrets and variables → Actions →
   Secrets). The maintainer adds them; they are never pasted anywhere else.

   | Secret | Value |
   |--------|-------|
   | `APPLE_CERTIFICATE` | base64 of the Developer ID `.p12` |
   | `APPLE_CERTIFICATE_PASSWORD` | the `.p12` password |
   | `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <Name> (<TEAMID>)` |
   | `APPLE_ID` | the Apple ID email |
   | `APPLE_PASSWORD` | the app-specific password |
   | `APPLE_TEAM_ID` | the Team ID |
   | `KEYCHAIN_PASSWORD` | any value (the CI keychain) |

5. **Turn it on:** in the same page, tab **Variables**, set
   `ENABLE_MAC_SIGNING` to `true`. The next tag produces signed, notarized
   `.app` and `.dmg` bundles. All the Apple values are gated together, so a
   half-configured set never makes a build attempt signing and fail.

`bundle.macOS.hardenedRuntime` is already enabled (required for notarization).

### 4. Windows code signing (optional)

Either **Azure Trusted Signing** (cloud, immediate SmartScreen trust, paid) via
`AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` plus a
`windows.signCommand` in `tauri.conf.json`, or a classic OV `.pfx` certificate
via `signtool`. Without either, Windows builds are unsigned (users see a
SmartScreen warning).

## What users see from an unsigned build

While a platform ships unsigned, the release notes must tell users how to get
past the first-open warning. The text to paste is in
[`docs/release-notes.md`](./release-notes.md); this is the reasoning behind it.

- **macOS 15 (Sequoia) and later.** Control-click → Open no longer bypasses
  Gatekeeper. The user tries to open the app once, then goes to System Settings
  → Privacy & Security and clicks **Open Anyway**. If macOS instead says the app
  "is damaged and can't be opened", that dialog has no Open Anyway: the way
  through is removing the quarantine attribute,
  `xattr -dr com.apple.quarantine /Applications/Asterisco.app`. The first
  `app-v1.0.0-rc.1` build, with no signature at all, got the "damaged" dialog.
  Since then `bundle.macOS.signingIdentity` is `"-"`, so builds without a
  Developer ID are **ad-hoc signed** — a valid signature with no identity —
  which is meant to turn "damaged" into the Open Anyway path; the smoke test of
  the next candidate confirms which dialog users get. A Developer ID set
  through `APPLE_SIGNING_IDENTITY` (step 3) overrides the `"-"`.
- **macOS 14 and earlier.** Control-click (or right-click) the app → Open, then
  Open in the dialog.
- **Windows.** SmartScreen shows "Windows protected your PC": More info → Run
  anyway.
- **Linux.** No warning. The AppImage needs the executable bit
  (`chmod +x`); the `.deb` installs through the package manager.

## Pre-tag manual smoke test

Run this checklist by hand before pushing an `app-v*` tag. The automated
end-to-end suite (`bun run test:e2e`) drives the frontend with a mocked backend,
so this checklist is what covers the real app and its native side. Run it in
`bun tauri dev`, and — whenever
practical — repeat the critical paths on a packaged build (`bun tauri build`)
so signing/packaging regressions are caught too. Do a pass in **both** `it` and
`en`. Stop and fix any unticked item before tagging.

For 1.0, `docs/release-1.0.md` merges this checklist with the device checks
from PR #12 into one two-column list, and lists the owner's remaining steps.

### Files & saving

- [ ] New file → type some Markdown → **Save**: file is written to disk and the
      dirty indicator clears.
- [ ] **Save As** to a new path: writes the new file; the tab tracks the new
      path.
- [ ] Edit a saved file → the dirty indicator appears; saving clears it again.

### Workspace & external changes

- [ ] Open a folder → the file tree shows its contents.
- [ ] Open a file from the tree → its content loads in the editor.
- [ ] Modify the open file **externally** (another editor) → the reload prompt
      appears and reloads the on-disk content.
- [ ] Delete the open file **externally** → the external-delete notification
      appears (no silent failure).

### Unsaved-changes guards (never lose data)

- [ ] Close a **tab** with unsaved changes → the save prompt appears.
- [ ] Close the **window** with unsaved changes → the save prompt appears.
- [ ] **Quit** the app with unsaved changes → the save prompt appears.

### Export & copy

- [ ] **File ▸ Print…** (`Ctrl/Cmd+P`) → save as PDF from the print dialog → valid file opens.
- [ ] Export to **HTML** → standalone file opens in a browser; `<html lang>`
      matches the active UI language.
- [ ] **Copy as HTML** → paste into a rich target keeps formatting.
- [ ] **Copy as Markdown** → paste yields the raw Markdown.

### Find & Replace · search

- [ ] **Find** highlights matches; **Next/Prev** navigate through them.
- [ ] Single **Replace** swaps the current match only.
- [ ] **Replace All** swaps every match.
- [ ] **Workspace search** finds matches across files in the open folder.

### Command palette

- [ ] Palette opens via its shortcut and runs a selected command.

### Native menu

- [ ] Every submenu item triggers its action (File, Edit, View, Find, Export,
      Settings, Help).
- [ ] Switch language **it ↔ en** → the menu relabels live.
- [ ] **About** dialog shows.
- [ ] **Check for Updates** works **offline** → graceful "couldn't check"
      message (no crash).

### Settings

- [ ] Change **theme / accent / fonts** → applies live in both modes.
- [ ] **Reset to defaults** → asks for confirmation, then resets.
- [ ] **View third-party notices** → renders the bundled notices.

### Updater

- [ ] Offline → graceful "couldn't check for updates" message; no crash.

### Accessibility quick pass

- [ ] Keyboard-only navigation of the main flows (open, edit, save, search,
      palette, menu).
- [ ] Focus is always visible while tabbing.
- [ ] UI renders correctly in both `it` and `en`.

## Cutting a release

Bump the version across all three manifests (`package.json`,
`src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`) and roll the changelog with
the bump script — pass the release date explicitly (it is never fabricated):

```sh
bun run version:set 1.0.0 2026-06-07   # <semver> <YYYY-MM-DD>
```

This also converts the `## [Unreleased]` changelog heading into
`## [1.0.0] — 2026-06-07` (omit the date to leave `[Unreleased]` intact and just
get a reminder). The repo currently sits at `1.0.0-rc.1`, the release candidate
tagged as `app-v1.0.0-rc.1` for the platform smoke test; the `1.0.0` bump is run on
the day of the tag, with that day's date. The 1.0.0 release
notes are already drafted under `## [Unreleased]` in `CHANGELOG.md`; at release,
also drop the "pre-1.0 development releases" note at the top of the changelog.
The script does not touch `src-tauri/Cargo.lock`: the next `cargo` build updates
the app's own entry there, so commit it with the bump. Review the diff, then
tag:

```sh
git tag app-v1.0.0
git push origin app-v1.0.0
```

The workflow builds macOS (arm64 + x64), Linux (deb + AppImage) and Windows
(NSIS), generates `THIRD-PARTY-NOTICES`, and creates a **draft** GitHub Release
with the bundles + `latest.json`. Paste the release notes from
[`docs/release-notes.md`](./release-notes.md) into the draft, filling in the
version, then verify and publish. For a release candidate (`app-v1.0.0-rc.1`),
tick **Set as a pre-release** if the draft is ever published: a pre-release is
never "latest", so the updater does not offer it.

## Build provenance attestations

After the build jobs, a separate `attest` job in `release.yml` records
[artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)
(SLSA build provenance, signed with Sigstore) for every file the release
built: the installers and bundles, the updater archives and their signatures.
Each build job records the SHA-256 of its files; the `attest` job alone holds
the OIDC token and the attestation permission, so they never reach the build
steps. The attestations are stored in the repository and say which workflow,
commit and tag produced each file.

Attestations need the repository to be **public** (on GitHub Free); the job is
skipped while it is private.

Anyone can check a downloaded package with the GitHub CLI:

```sh
gh attestation verify <downloaded-file> --repo fabioshepherd/asterisco \
  --signer-workflow fabioshepherd/asterisco/.github/workflows/release.yml
```

Verification matches the file's SHA-256 digest, so a renamed file still
verifies; a modified one does not. `--signer-workflow` is optional but
recommended: it also checks that the release workflow, not some other one,
produced the file. Attestations complement the updater signature (which the
app checks on its own) and do not replace platform code signing.

## Third-party notices

`bun run notices` regenerates `src-tauri/THIRD-PARTY-NOTICES.txt` (Rust via
`cargo-about`, npm via `generate-license-file`). CI runs it before packaging so
the shipped bundle carries the full license texts. All dependencies are
permissive (MIT/Apache/ISC/BSD/Unicode/MPL-2.0); no GPL/AGPL/LGPL.
