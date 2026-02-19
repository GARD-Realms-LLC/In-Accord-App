InAccord Launcher UI

This folder contains the small Electron-based launcher UI used to present a modal installer/launcher to end users.

How to build (produce GUI-only Windows EXE):

1. Ensure dependencies are installed at the repo root (run once):

```powershell
# from repository root
npm install
# optionally install electron-builder globally or use npx as below
```

2. Build the main project assets and dist (renderer/preload):

```powershell
bun run build
```

3. Build the GUI-only Windows EXE (packages launcher-ui as a portable exe):

```powershell
# from repository root
npm run build:launcher:electron
```

This will produce a portable Windows exe under `dist/launcher-build`.

Notes:
- The packaged Electron EXE will be a GUI application (no console window) and will run the modal UI which auto-detects Discord, applies the injector, and launches the selected client.
- To embed additional files or icons, update `scripts/launcher-ui/package.json` `build.files` and `win.icon`.
