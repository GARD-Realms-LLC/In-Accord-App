import Builtin from "@structs/builtin";

import IPC from "@modules/ipc";

const runtimePlatform = ((globalThis as any).process?.platform as string | undefined) ?? "win32";

export default new class DevToolsListener extends Builtin {
    get name() {return "DevTools";}
    get category() {return "developer";}
    get id() {return "devTools";}

    async initialize() {
        super.initialize();
        this.toggleDevTools = this.toggleDevTools.bind(this);
        document.addEventListener("keydown", this.toggleDevTools);
    }

    toggleDevTools(e: KeyboardEvent) {
        const metaKey = runtimePlatform === "darwin" ? e.metaKey : e.ctrlKey;
        if (metaKey && e.shiftKey && e.key === "I") {
            e.stopPropagation();
            e.preventDefault();
            if (this.get(this.collection, this.category, this.id)) IPC.toggleDevTools();
        }
    }
};