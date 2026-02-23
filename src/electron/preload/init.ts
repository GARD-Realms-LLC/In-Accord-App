import {ipcRenderer as IPC} from "electron";
import * as IPCEvents from "@common/constants/ipcevents";


export default function () {
    // Load Discord's original preload
    const preload = process.env.DISCORD_PRELOAD;
    if (preload) {

        // Restore original preload for future windows
        IPC.send(IPCEvents.REGISTER_PRELOAD, preload);
        // Run original preload
        const originalKill = process.kill;
        try {
            process.kill = function (_: number, __?: string | number | undefined) {return true;};
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require(preload);
        }
        catch (error) {
            // eslint-disable-next-line no-console
            console.error("[InAccord] Failed to run Discord preload", preload, error);
        }
        finally {
            process.kill = originalKill;
        }
    }
}