import * as IPCEvents from "@common/constants/ipcevents";
import {ipcRenderer} from "electron";

export function open(type: "theme" | "plugin", filename: string): void;
export function open(type: "custom-css"): void;
export function open(type: "custom-css" | "theme" | "plugin", filename?: string): void {
    ipcRenderer.invoke(IPCEvents.EDITOR_OPEN, type, filename);
}

export function updateSettings(settings: any) {
    // In Discord-injection contexts the editor main-module may not be running.
    // Avoid spamming unhandledrejection when the handler isn't registered.
    try {
        return ipcRenderer.invoke(IPCEvents.EDITOR_SETTINGS_UPDATE, settings).catch((err) => {
            const msg = String((err as any)?.message ?? err);
            if (msg.includes("No handler registered") && msg.includes(IPCEvents.EDITOR_SETTINGS_UPDATE)) {
                return null;
            }
            throw err;
        });
    }
    catch (err) {
        return Promise.resolve(null);
    }
}

export function onLiveUpdateChange(listener: (state: boolean) => void) {
    function callback(_: unknown, state: boolean) {
        listener(state);
    }

    ipcRenderer.on(IPCEvents.EDITOR_SETTINGS_UPDATE, callback);
    return () => {
        ipcRenderer.off(IPCEvents.EDITOR_SETTINGS_UPDATE, callback);
    };
}