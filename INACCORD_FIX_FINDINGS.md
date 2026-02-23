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

## Stable shows no menu/toasts/modals (2026-02-23)

### What was happening
Discord Stable can appear to “install” In-Accord but show no UI at all when the patch in `discord_desktop_core/index.js` points at a **stale absolute path**.

This repo previously wrote a BetterDiscord-style core patch but still depended on embedding one exact absolute `require("C:\\...\\dist")` or `require("C:\\...\\InAccord.asar")` path. If that build folder moved, was deleted, or a prior run patched a different folder, Discord would continue to load `core.asar` normally while In-Accord never loads → no menu / no toast / no modal popups.

### Fix implemented
`scripts/inject.ts` now writes a BetterDiscord-style core patch that **resolves the In-Accord package path at runtime**:
- Uses `INACCORD_PACKAGE_PATH` when set.
- Falls back to the build-time dist/asr path (dev convenience).
- Falls back to `%APPDATA%\\InAccord\\InAccord.asar` and `%APPDATA%\\InAccord\\dist` (BetterDiscord-style roaming install locations).

This prevents Stable from silently breaking when paths change.

### Additional root-cause found (launcher patch hits wrong discord_desktop_core folder)
On some Discord installs, the folder names under `app-*/modules/` include multiple wrappers like:
- `discord_desktop_core-2`
- `discord_desktop_core-10`

The launcher previously selected the wrapper by **lexicographic** sorting, which can pick the wrong one (`10` vs `2`), resulting in patching an unused core folder. When that happens, Discord never executes the patched `index.js` → coreloader never runs → **all markers missing** (preload/mainhook/running/inject_status).

Fix: wrapper selection is now **version-aware** in both:
- `scripts/launcher-ui/main.js` (`findDiscordDesktopCoreDirWin`)
- `scripts/inject.ts` (`patchDiscordDesktopCoreIndex` + `restoreDiscordDesktopCoreIndex`)

### Packaging hardening
`scripts/pack.ts` now also includes `mainhook.js` and `coreloader.js` in `InAccord.asar` so the release bundle always carries the full loader set.

### Launcher install behavior (Stable)
The launcher now attempts `app.asar` patching on Install as a **best-effort, timeboxed** step even when `discord_desktop_core/index.js` patching succeeds.

Reason: some Stable installs appear to load Discord core from `app.asar` (or otherwise bypass the disk `discord_desktop_core` folder), which makes the disk core patch look successful but results in **no coreloader execution** (no markers/logs). Timeboxing remains in place to avoid hangs.

### New runtime marker to prove core patch execution
The launcher-written `discord_desktop_core/index.js` patch now writes real marker files under `%APPDATA%\InAccord`:
- `InAccord.core_index_ran.<channel>.json` when the patched `index.js` is executed.
- `InAccord.core_index_error.<channel>.json` if the `require(<coreloader>)` throws.

This makes the "payload installed but all markers missing" state diagnosable without relying on DevTools or manual copying.

## Stable not loading UI (menus/toasts/modals) – BetterDiscord-style injection alignment (2026-02-23)

### Root cause
In-Accord’s built output names and the runtime loader expectations did not match:

- Build outputs:
	- `dist/InAccord.js`
	- `dist/preload.js`
	- `dist/mainhook.js`
	- `dist/coreloader.js`

- But the loader code was looking for channel-suffixed files:
	- `InAccord.stable.js`
	- `preload.stable.js`
	- `mainhook.stable.js`

So even when the preload executed, it often bailed out early because the expected bundle file did not exist → no renderer boot → no menu/toast/modal UI.

Separately, the prior injector approach mixed two different installation models:
- It patched Discord to load a loader from `%APPDATA%\<channel>\InAccord\coreloader.js`.
- But the loader chain was resolving runtime files from `%APPDATA%\InAccord\...` (roaming root).

That mismatch also prevented the chain from reaching the renderer.

### Changes made
To match BetterDiscord’s “patch discord_desktop_core/index.js to require() a built package path” behavior and fix the filename mismatch:

- `src/electron/preload/index.ts`
	- Now falls back to `InAccord.js` when `InAccord.<channel>.js` is not present.

- `src/electron/coreloader/index.ts`
	- Now resolves its runtime relative to `__dirname` and loads `mainhook.js` if the channel-suffixed variant is missing.

- `src/electron/mainhook/index.ts`
	- Now resolves its runtime relative to `__dirname` and prefers `preload.js` / `InAccord.js` while still supporting older channel-suffixed filenames.

- `scripts/inject.ts`
	- Updated to BetterDiscord-style injection: patch `discord_desktop_core/index.js` to `require(<absolute In-Accord package path>)` then `module.exports = require('./core.asar')`.
	- Uses `dist/` for dev injection and `dist/InAccord.asar` for `release` injection.
	- Removes the old “copy loaders into %APPDATA% then patch to %APPDATA% loader path” model.

### Release bundle fix
The `InAccord.asar` packer was listing files as `dist/<file>` while the base directory was already `dist`, which would nest paths incorrectly and break `require('.../InAccord.asar')`.

- `scripts/pack.ts`
	- Fixed `createPackageFromFiles(dist, ...)` file list to use paths relative to `dist` (e.g. `main.js`, `package.json`, `preload.js`, `InAccord.js`, etc.).
