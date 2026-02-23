import Remote from "@polyfill/remote";

import * as IPCEvents from "@common/constants/ipcevents";

import Events from "./emitter";


export default new class IPCRenderer {

    constructor() {
        const ipc: any = Remote?.electron?.ipcRenderer;
        if (!ipc || typeof ipc.on !== "function") return;

        ipc.on(IPCEvents.NAVIGATE, () => Events.dispatch("navigate"));
        ipc.on(IPCEvents.MAXIMIZE, () => Events.dispatch("maximize"));
        ipc.on(IPCEvents.MINIMIZE, () => Events.dispatch("minimize"));
    }

    openDevTools() {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.OPEN_DEVTOOLS);
    }

    closeDevTools() {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.CLOSE_DEVTOOLS);
    }

    toggleDevTools() {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.TOGGLE_DEVTOOLS);
    }

    relaunch(args?: string[]) {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.RELAUNCH, args);
    }

    runScript(script: string) {
        return Remote?.electron?.ipcRenderer?.invoke?.(IPCEvents.RUN_SCRIPT, script);
    }

    openWindow(url: string, options: {windowOptions: object; closeOnUrl: boolean;}) {
        return Remote?.electron?.ipcRenderer?.invoke?.(IPCEvents.OPEN_WINDOW, url, options);
    }

    inspectElement() {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.INSPECT_ELEMENT);
    }

    setMinimumSize(width: number, height: number) {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.MINIMUM_SIZE, width, height);
    }

    setWindowSize(width: number, height: number) {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.WINDOW_SIZE, width, height);
    }

    stopDevtoolsWarning() {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.DEVTOOLS_WARNING);
    }

    // TODO: merge dialog options type with mian process
    openDialog(options: object) {
        return Remote?.electron?.ipcRenderer?.invoke?.(IPCEvents.OPEN_DIALOG, options);
    }

    getSystemAccentColor(): Promise<string> {
        return Remote?.electron?.ipcRenderer?.invoke?.(IPCEvents.GET_ACCENT_COLOR);
    }

    openPath(path: string) {
        return Remote?.electron?.ipcRenderer?.send?.(IPCEvents.OPEN_PATH, path);
    }
};