# Security Policy

We take the security of Asterisco seriously. This document explains how to report a
vulnerability and what is currently supported.

## Supported versions

Security fixes are released for the latest 1.x version only. Updating through
the app's built-in update check (or downloading the latest release) is the way
to receive them.

| Version | Supported |
| --- | --- |
| 1.x (latest release) | Yes |
| < 1.0 (development builds) | No |

## Reporting a vulnerability

**Please do not open a public issue, pull request, or discussion for security
vulnerabilities.** Public disclosure before a fix is available puts users at risk.

Instead, report it privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
open the repository's **Security** tab and choose **Report a vulnerability**.
That opens a draft security advisory visible only to you and the maintainer.
This is the only reporting channel; there is no security email address.

Please include, where possible:

- a description of the issue and its potential impact;
- steps to reproduce (a minimal proof of concept helps);
- affected version / platform and any relevant configuration.

The project is maintained by one person in their spare time, so there is no
guaranteed response time. We aim to acknowledge a report within a week,
investigate it, and keep you informed in the advisory. Once a fix is released,
the advisory is published and, with your agreement, credits you. Please give us
reasonable time to release a fix before any public disclosure.

## Scope

In scope: the Asterisco desktop app and its source in this repository,
including the release workflow and the update mechanism. Out of scope: issues
that need an attacker who already controls the user's account or machine, and
vulnerabilities in third-party dependencies that do not affect Asterisco (report
those upstream; Dependabot keeps the dependencies here current).

## Security posture

A few facts that may help when assessing reports:

- **Local-first.** The app runs fully offline. It collects no telemetry, and the
  only outbound network connection is the user-triggered update check to GitHub
  Releases (see [PRIVACY.md](./PRIVACY.md)).
- **Restrictive Content-Security-Policy.** The WebView enforces a restrictive CSP
  (`default-src 'self'`, no external origins; see
  [ARCHITECTURE.md](./ARCHITECTURE.md)).
- **Backend I/O through Rust commands.** All filesystem and native I/O goes
  through an explicit, reviewable set of Rust commands; the frontend is granted
  no `fs:*` permission. Those commands are **not** limited to paths chosen in a
  dialog: they act on any absolute path they are given, with the user's own OS
  permissions. The boundary is that no script from a document runs in the
  WebView (CSP, sanitised HTML, a navigation guard that keeps the window on the
  app page). Restricting the commands to folders the user has opened is a
  planned later hardening, not part of 1.0. See
  [ARCHITECTURE.md](./ARCHITECTURE.md) for the exact capability list.
