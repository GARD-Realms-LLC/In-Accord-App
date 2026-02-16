import path from "path";
import Store from "./base";
import process from "../../electron/preload/process";

const iaDataPath = process.env.InAccord_DATA_PATH ?? process.env.inaccord_DATA_PATH ?? "";
const backupFolderName = process.env.inaccord_BACKUP_FOLDER ?? "backup";


export default new class ConfigStore extends Store {
    data = {
        branch: process.env.__BRANCH__!,
        commit: process.env.__COMMIT__!,
        build: process.env.__BUILD__!,
        version: process.env.__VERSION__!,

        // TODO: asynchronously get these from the mian process instead of hacky env vars
        appPath: process.env.DISCORD_APP_PATH!,
        userData: process.env.DISCORD_USER_DATA!,
        iaPath: iaDataPath,
        dataPath: path.join(iaDataPath, "data"),
        backupPath: path.join(iaDataPath, backupFolderName),
        pluginsPath: path.join(iaDataPath, "plugins"),
        themesPath: path.join(iaDataPath, "themes"),
        channelPath: path.join(iaDataPath, "data", window?.DiscordNative?.app?.getReleaseChannel?.() ?? "stable"),
    };

    get(id: keyof typeof this.data) {
        return this.data[id];
    }

    set(id: keyof typeof this.data, value: string) {
        this.data[id] = value;
        this.emitChange();
    }

    get isDevelopment() {return this.data.build !== "production";}
    get isCanary() {return this.data.branch !== "mian";}
};