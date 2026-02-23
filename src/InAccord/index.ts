import secure from "./secure";
import LoadingIcon from "./loadingicon";
import InAccord from "@modules/core";
import iaApi from "@api/index";

const notifyStartupFailure = (error: unknown) => {
    const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

    try {
        document.documentElement?.setAttribute?.("data-inaccord-renderer", "startup-error");
        document.documentElement?.setAttribute?.("data-inaccord-startup-error", String(message).slice(0, 500));
    }
    catch {}

    try {
        const existing = document.getElementById("ia-startup-failure-banner");
        if (!existing) {
            const banner = document.createElement("div");
            banner.id = "ia-startup-failure-banner";
            banner.textContent = `In-Accord failed to start: ${message}`;
            banner.style.position = "fixed";
            banner.style.top = "16px";
            banner.style.left = "16px";
            banner.style.zIndex = "2147483647";
            banner.style.maxWidth = "640px";
            banner.style.padding = "12px 14px";
            banner.style.borderRadius = "8px";
            banner.style.background = "#d83c3e";
            banner.style.color = "#fff";
            banner.style.fontFamily = "gg sans, system-ui, sans-serif";
            banner.style.fontSize = "14px";
            banner.style.fontWeight = "600";
            banner.style.boxShadow = "0 6px 20px rgba(0,0,0,0.35)";
            document.body.appendChild(banner);
        }
    }
    catch {}

    try {window.alert(`In-Accord failed to start.\n\n${message}`);} catch {}
};

// Perform some setup
secure();
try {
    document.documentElement?.setAttribute?.("data-inaccord-renderer", "boot");
}
catch {}
Object.defineProperty(window, "iaApi", {
    value: iaApi,
    writable: false,
    configurable: false
});
Object.defineProperty(window, "IaApi", {
    value: iaApi,
    writable: false,
    configurable: false
});
window.global = window;

// Add loading icon at the bottom right
LoadingIcon.show();
void InAccord.startup().then(() => {
    try { document.documentElement?.setAttribute?.("data-inaccord-renderer", "startup-complete"); } catch {}
}).catch(notifyStartupFailure);