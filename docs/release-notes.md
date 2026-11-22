# Release notes template

Paste everything below the line into the body of the draft GitHub Release that
`release.yml` creates, replace `<version>` (for example `1.0.0` or
`1.0.0-rc.1`), and copy the matching section of `CHANGELOG.md` into "What's
new". For a release candidate keep the pre-release paragraph; for a final
release delete it. When a platform starts shipping signed builds, delete its
first-open paragraph. `docs/RELEASING.md` ("What users see from an unsigned
build") explains each step.

---

**Asterisco** is a native, local-first Markdown editor for the files a codebase
is made of: READMEs, ADRs, specs, changelogs and agent briefs. Free and open
source under the MIT license.

> **Release candidate.** This build is for testing before `<version>` final.
> The in-app updater does not offer it, and it will not update itself to the
> final release: install the final release by hand when it is out.

## What's new

<!-- Copy the CHANGELOG.md section for this version here. -->

See [CHANGELOG.md](https://github.com/fabioshepherd/asterisco/blob/main/CHANGELOG.md)
for the full history.

## Download

| Platform | File |
|---|---|
| macOS, Apple Silicon (M1 and later) | `…_aarch64.dmg` |
| macOS, Intel | `…_x64.dmg` |
| Windows 10/11 (64-bit) | `…_x64-setup.exe` |
| Linux, Debian / Ubuntu | `…_amd64.deb` |
| Linux, other distributions | `…_amd64.AppImage` |

The `.tar.gz`, `.zip` and `.sig` files and `latest.json` are used by the in-app
updater; you do not need to download them.

## First open

These builds are not signed with an Apple or Microsoft certificate yet, so the
operating system warns the first time you open the app. Asterisco makes no
network calls except the update check you start yourself.

**macOS 15 (Sequoia) and later.** Drag Asterisco to Applications and open it
once; macOS refuses. Then open System Settings → Privacy & Security, scroll to
the message about Asterisco and click **Open Anyway**. If macOS says the app
"is damaged and can't be opened", run this in Terminal and open it again:

```sh
xattr -dr com.apple.quarantine /Applications/Asterisco.app
```

**macOS 14 and earlier.** Control-click (or right-click) Asterisco in
Applications, choose **Open**, then **Open** in the dialog.

**Windows.** If SmartScreen shows "Windows protected your PC", click **More
info** → **Run anyway**.

**Linux.** Install the `.deb` with your package manager, or make the AppImage
executable (`chmod +x` on the downloaded file) and run it.

## Verify a download

Every file carries a build provenance attestation. With the
[GitHub CLI](https://cli.github.com):

```sh
gh attestation verify <downloaded-file> --repo fabioshepherd/asterisco
```
