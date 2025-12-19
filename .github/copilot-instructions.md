# InAccord Installer - AI Coding Agent Instructions

## Architecture Overview
This is an Electron-based installer for InAccord, a Discord client mod built on InAccord's core. The app consists of:
- **Main Process** (`src/electron/main/`): Window management, IPC, Discord patching
- **Renderer Process** (`src/renderer/`): Svelte-based installer UI with routing
- **InAccord Core** (`src/InAccord/`): Mod injection code with managers for plugins/themes/addons
- **Build System**: esbuild via Bun scripts for multi-entry bundling

## Key Patterns & Conventions
- **Imports**: Use `@` aliases (e.g., `@modules/core`, `@api/index`) over relative paths. Prefer whole module imports: `import Utilities from "./utilities"` not destructured.
- **Class Structure**: Static methods/properties first, then instance. Inline `export default` with class declarations.
- **ESLint Rules**: Strict formatting (Stroustrup braces, Windows linebreaks, no console.log). See `.eslintrc` for full rules.
- **IPC Communication**: Use `src/InAccord/modules/ipc.ts` for main↔renderer communication with event constants from `src/common/constants/ipcevents.ts`.
- **Addon System**: Plugins/themes managed via `PluginManager`/`ThemeManager` in `src/InAccord/modules/`. APIs exposed through `BdApi` (`src/InAccord/api/`).
- **i18n**: Locale files in `assets/locales/`, managed by `LocaleManager`. Use `src/common/i18n.ts` for translations.

## Development Workflows
- **Build**: `bun run build` (esbuild bundles to `dist/`, externalizes Node/Electron APIs)
- **Watch Mode**: `bun run watch` for auto-rebuild during development
- **Testing**: `bun run test` runs tests in `tests/` directory
- **Linting**: `yarn lint` (ESLint with Svelte support)
- **Distribution**: `yarn dist` builds and packages with electron-builder

## Common Tasks
- **Adding UI Components**: Place in `src/renderer/common/` or `pages/`, use Svelte stores from `stores/`
- **Modifying Core Behavior**: Update managers in `src/InAccord/modules/`, ensure compatibility with InAccord API
- **Adding Translations**: Update JSON files in `assets/locales/`, regenerate with translation scripts
- **IPC Events**: Register in main process via `ipc.registerEvents()`, handle in renderer with `window.BdApi.IPC.on()`

## Examples
- **New Plugin API**: Add to `src/InAccord/api/index.ts`, export via BdApi object
- **Build Entry**: Add to `moduleConfigs` in `scripts/build.ts` for new bundles
- **Manager Pattern**: Follow `PluginManager` structure with async init/startup methods

Reference: `src/InAccord/index.ts` (entry), `src/InAccord/modules/core.ts` (startup), `package.json` (scripts)</content>
<parameter name="filePath">.github/copilot-instructions.md