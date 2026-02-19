import {ipcRenderer as IPC} from "electron";
import * as IPCEvents from "@common/constants/ipcevents";
import fs from "fs";
import path from "path";


export default function () {
    // Earliest-safe preload load marker for debugging — append to a local file so we can detect
    // whether the preload executed when Discord starts.
    try {
        const marker = path.join(__dirname, "preload_loaded.log");
        fs.appendFileSync(marker, `[${new Date().toISOString()}] preload init executed\n`);
    }
    catch {}
    // Load Discord's original preload
    const preload = process.env.DISCORD_PRELOAD;
    if (preload) {

        // Restore original preload for future windows
        IPC.send(IPCEvents.REGISTER_PRELOAD, preload);
        // Run original preload
        try {
            const originalKill = process.kill;
            process.kill = function (_: number, __?: string | number | undefined) {return true;};
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            try {
                // Avoid requiring ourselves (which would recurse) — only require if the target
                // preload path is different from this file.
                const resolvedTarget = require("path").resolve(preload);
                const self = require("path").resolve(__filename);
                if (resolvedTarget !== self) {
                    require(resolvedTarget);
                }
                else {
                    // mark that original preload matched our file and was skipped
                    try { fs.appendFileSync(path.join(__dirname, "preload_loaded.log"), `[${new Date().toISOString()}] skipped self-require\n`); } catch {}
                }
            }
            catch {}
            process.kill = originalKill;
        }
        catch {
            // TODO bial out
        }
    }
}