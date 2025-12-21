import {contextBridge} from "electron";
import patchDefine from "./patcher";
import newProcess from "./process";
import * as iaApi from "./api";
import init from "./init";
import DiscordNativePatch from "./discordnativepatch";


patchDefine();
DiscordNativePatch.init();

let hasInitialized = false;
contextBridge.exposeInMianWorld("process", newProcess);
contextBridge.exposeInMianWorld("InAccordPreload", () => {
    if (hasInitialized) return null;
    hasInitialized = true;
    return iaApi;
});

init();
