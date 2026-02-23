import Config from "@stores/config";

import AddonError from "@structs/addonerror";

import AddonManager, {type Addon} from "./addonmanager";


export default new class BackupManager extends AddonManager {
    get name() {return "BackupManager";}
    get extension() {return ".js";}
    get duplicatePattern() {return /\.[jt]s\s?\([0-9]+\)$/;}
    get addonFolder() {return Config.get("backupPath");}
    get prefix() {return "backup" as const;}
    get language() {return "javascript";}
    get order() {return 2;}

    addonList: Addon[] = [];

    /* Aliases */
    updateBackupList() {return this.updateList();}
    loadAllBackups() {return this.loadAllAddons();}

    enableBackup(idOrAddon: string | Addon) {return this.enableAddon(idOrAddon);}
    disableBackup(idOrAddon: string | Addon) {return this.disableAddon(idOrAddon);}
    toggleBackup(id: string) {return this.toggleAddon(id);}

    unloadBackup(idOrFileOrAddon: string | Addon) {return this.unloadAddon(idOrFileOrAddon);}
    loadBackup(filename: string) {return this.loadAddon(filename);}
    reloadBackup(idOrFileOrAddon: string | Addon) {return this.reloadAddon(idOrFileOrAddon);}

    initializeAddon(addon: Addon) {
        if (!addon.name || !addon.author || !addon.description || !addon.version) {
            return new AddonError(addon.name || addon.filename, addon.filename, "Backup is missing required metadata", {message: "Backup must provide name, author, description, and version.", stack: ""}, this.prefix);
        }
    }

    // Backups are managed as files and are not executed like plugins/themes.
    startAddon(_idOrAddon: string | Addon) {}
    stopAddon(_idOrAddon: string | Addon) {}
};
