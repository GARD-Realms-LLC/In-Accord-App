# InAccord Installer

A standalone installer and integration toolkit for InAccord.

## Requirements

- [Bun](https://bun.sh/) (latest stable recommended)
- Node.js (for helper scripts that run via `node`)
- Discord Stable/PTB/Canary (optional, for injection workflow)

## Development

From the repository root (`E:\InAccord-Apps`):

- Build once:
  - `bun run build`
- Build in watch mode:
  - `bun run start`

## Run / Inject into Discord

Quick commands:

- Stable: `bun run run:stable`
- PTB: `bun run run:ptb`
- Canary: `bun run run:canary`

Release bundle variants:

- Stable: `bun run run:stable:release`
- PTB: `bun run run:ptb:release`
- Canary: `bun run run:canary:release`

These commands:

1. Build the project
2. Optionally pack `.asar` (release variants)
3. Inject into the selected Discord channel

After injection, fully quit Discord (including tray/background) and reopen it.

## Platform Compatibility

| Platform | Status | Notes |
|---|---|---|
| Windows | ✅ Supported | Primary injection path is implemented and tested in this repo. |
| macOS | ✅ Supported | Desktop-only support through Electron/Discord desktop integration. |
| Linux | ✅ Supported* | Supported for desktop Discord; behavior can vary by packaging (native, Flatpak, Snap, etc.). |
| Web (browser Discord) | ❌ Not supported | This project relies on Electron main/preload injection and cannot run in browser Discord as-is. |

\* Linux support may require environment/path adjustments depending on distro and Discord install method.

## Quality Checks

- Lint: `bun run lint`
- Test: `bun run test`

> Note: this repository may not include active tests in all environments.

## Notes

- Source structure includes Electron main/preload and InAccord runtime modules under `src/`.
- Build outputs are written to `dist/`.
