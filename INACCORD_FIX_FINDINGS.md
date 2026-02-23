# In-Accord findings / fix log

Date: 2026-02-23

## What was happening

### Stable not injecting / no In-Accord UI (menus/toasts/modals)
The loader chain (Discord-side `coreloader` → `mainhook` → renderer `preload` → `InAccord.js`) relies on resolving the Discord *Roaming* data folder on Windows.

Multiple places in this repo hard-coded Stable’s roaming folder as:
- `%APPDATA%\Discord`

But Stable is also commonly:
- `%APPDATA%\discord`

Even when Windows is case-insensitive, a very common failure mode is that **both** folders exist:
- `%APPDATA%\Discord` (created/used by Discord Stable)
- `%APPDATA%\discord` (created by a previous tool run or manual copy)

If the installer/launcher picks the wrong one when both exist, it installs payload + writes marker files to a folder Discord is **not** reading from.

Net effect: the launcher may say it installed, but Discord never loads In-Accord → no toast/menu/modal UI.

Another linked failure: `discord_desktop_core/index.js` can already be patched but still point at an **old** absolute loader path.
If the Stable base folder changes (or a previous run created `%APPDATA%\discord`), the patch remains, Discord keeps requiring the stale loader, and nothing starts.

Separately, `app.asar` patching can take a long time or hang (file locking / AV scanning). This is not required when the core index patch is applied.

Net effect: the launcher may say it installed, but Discord never loads In-Accord → no toast/menu/modal UI.

### Launcher top-right window controls
The launcher window was created with the default framed window, so Windows shows the native caption buttons (minimize/maximize/close).

## Changes made

### Stable roaming folder resolution is now case-robust
Updated code to prefer `%APPDATA%\Discord` (official Stable folder) when present, and **avoid selecting `%APPDATA%\discord` just because it exists** (that creates/locks in the "two Stable folders" problem).

If neither exists yet, code now defaults to `%APPDATA%\Discord` so we don’t create a parallel folder Discord won’t use.

Affected locations:
- `scripts/launcher-ui/main.js` (`getChannelBaseDir()`)
- `src/electron/coreloader/index.ts`
- `src/electron/mainhook/index.ts`

### Core index patch is now self-healing
Updated the core patchers so "already patched" only counts when it points at the current loader path *and* that loader exists. Otherwise it rewrites the patch:
- `scripts/launcher-ui/main.js` (`patchDiscordCoreIndex()`)
- `scripts/inject.ts` (`patchDiscordDesktopCoreIndex()`)

Also hardened the launcher’s "core patched" detection so it does not treat Discord as patched when the patch points at a missing loader path (prevents launching in a broken patched mode):
- `scripts/launcher-ui/main.js` (`isDiscordCoreIndexPatched()`)


### Removed launcher caption buttons
Launcher now uses a frameless BrowserWindow and a thin invisible drag region so the window remains movable:
- `scripts/launcher-ui/main.js` (`frame: false`)
- `scripts/launcher-ui/index.html` (added `#dragRegion` with `-webkit-app-region: drag`)

## ESLint setup (2026-02-23)

### What I inspected
- `package.json`
- `eslint.config.js`

### Changes made
- Updated `package.json` `lint` script to run ESLint via the standard `eslint` binary instead of `bun x eslint`.
	- This keeps linting consistent with typical Node tooling and avoids Bun-specific execution requirements.
- Aligned ESLint dependency version with the repo’s existing flat config (`eslint.config.js` + `@eslint/js@9.34.0`) by setting `eslint` to `^9.34.0`.
