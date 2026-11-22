# Privacy Policy

_Last updated: 2026-06-07_

This privacy policy describes how the app handles your data. The short version:
the app is local-first and does not collect anything. It runs entirely on your
device.

## No telemetry, analytics, or tracking

The app contains no telemetry, no analytics, and no tracking of any kind. It does
not profile you, does not send usage statistics, and does not phone home in the
background. No account is required to use the app.

## Your documents stay on your device

The documents you create and edit are plain Markdown (`.md`) files stored on your
own disk, in the locations you choose. The app reads and writes these files
locally; it never uploads them anywhere.

## Locally stored settings

Your preferences are stored locally on your device and never leave it:

- application settings (theme, accent colour, language, editor options),
  recent files and folders, and your customized keybindings are kept in a local
  JSON store on your device (via `tauri-plugin-store`);
- custom themes you enable are read from local CSS files you point the app at.

You can inspect or delete this data at any time by removing the app's local
settings; doing so simply resets the app to its defaults.

## Network access

The app is designed to work fully offline. The only outbound network connection
it makes is one you trigger yourself:

- **Check for Updates.** When you choose "Check for Updates" (or accept an
  available update), the app contacts GitHub Releases to look for a newer version
  and, if you confirm, to download it. This request reaches GitHub's servers, so
  GitHub may process it (for example, your IP address) under its own privacy
  terms. See GitHub's privacy documentation at
  <https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement>.

No other network requests are made. The app does not include AI, sync, or
cloud-upload features.

## Data sharing

The app does not sell, rent, or share your data with anyone. There is no data to
share: nothing is collected.

## Changes to this policy

This policy may be updated as the app evolves. Material changes will be reflected
in the version of this document distributed with the app, with an updated date at
the top.

## Contact

For privacy questions, open an issue on the project's GitHub repository.
