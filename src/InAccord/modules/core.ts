import Logger from "@common/logger";

import Config from "@stores/config";
import Changelog from "@data/changelog";

import LoadingIcon from "../loadingicon";

import LocaleManager from "./localemanager";
import DOMManager from "./dommanager";
import Settings from "@stores/settings";
import ToastStore from "@stores/toasts";
import DiscordModules from "./discordmodules";

import Styles from "@styles/index.css";
import Modals from "@ui/modals";
import FloatingWindows from "@ui/floatingwindows";
import Toasts from "@ui/toasts";
import SettingsRenderer from "@ui/settings";
import ManagerHubPanel from "@ui/settings/managerhub";
import AboutPanel from "@ui/settings/about";
import CommandManager from "./commandmanager";
// import NotificationUI from "@ui/notifications";
import InstallCSS from "@ui/customcss/mdinstallcss";
import {getStore, waitForWebpackRequire} from "@webpack";
import Patcher from "./patcher";
import {BriefcaseIcon, GithubIcon, Info, LayoutGridIcon} from "lucide-react";
import React from "@modules/react";
import type {DiscordProps} from "@utils/icon";
import {lucideToDiscordIcon} from "@utils/icon";

const iconSizes = {
    xxs: 12,
    xs: 16,
    sm: 18,
    md: 24,
    lg: 32,
    refresh_sm: 20
} as const;

const ManagerHubSplashIcon = lucideToDiscordIcon(BriefcaseIcon);

const OurServerDiscordIcon = (props: DiscordProps) => {
    const size = props.size === "custom"
        ? {width: props.width, height: props.height}
        : {width: `${iconSizes[props.size || "xs"]}px`, height: `${iconSizes[props.size || "xs"]}px`};

    return React.createElement("svg", {
        xmlns: "http://www.w3.org/2000/svg",
        viewBox: "0 0 24 24",
        className: props.className,
        style: {
            ...size,
            display: "block",
            flexShrink: 0
        }
    }, React.createElement("path", {
        fill: props.color || "currentColor",
        d: "M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.249.077.077 0 0 0-.079-.037 19.736 19.736 0 0 0-4.885 1.515.069.069 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.17 14.17 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .078-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.121.099.247.198.373.291a.077.077 0 0 1-.006.128 12.299 12.299 0 0 1-1.873.891.076.076 0 0 0-.04.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .031-.055c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.334.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.334.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419z"
    }));
};

export default new class Core {
    hasStarted = false;
    startupAttempts = 0;
    maxStartupAttempts = 8;
    startupRetryTimer: ReturnType<typeof setTimeout> | null = null;

    trustInAccordProtocol() {
        try {
            const store: any = getStore("MaskedLinkStore");
            if (!store || typeof store.isTrustedProtocol !== "function") return;
            Patcher.after("InAccordProtocol", store, "isTrustedProtocol", (_, [url]: any, ret) => ret || url.startsWith("inaccord://"));
        }
        catch {}
    }

    async startup() {
        if (this.hasStarted) return;
        this.hasStarted = true;
        this.startupAttempts++;
        let startupStage = "boot";

        const setDomStatus = (status: string, extra?: Record<string, any>) => {
            try {
                const de: any = document?.documentElement;
                if (!de?.setAttribute) return;
                de.setAttribute("data-inaccord-renderer", String(status || ""));
                de.setAttribute("data-inaccord-startup-stage", String(startupStage || ""));
                de.setAttribute("data-inaccord-startup-attempt", String(this.startupAttempts));
                if (extra) {
                    for (const [k, v] of Object.entries(extra)) {
                        try { de.setAttribute(`data-inaccord-${k}`, String(v ?? "").slice(0, 500)); } catch {}
                    }
                }
            }
            catch {}
        };

        try {
            startupStage = "webpack-wait";
            setDomStatus("starting");
            Logger.log("Startup", "Waiting for Discord webpack runtime...");
            await waitForWebpackRequire(30000);

            setDomStatus("webpack-ready");

            const preloadApi = (() => {
                try {
                    const fn: any = (window as any).InAccordPreload;
                    if (typeof fn === "function") return fn();
                }
                catch {}
                return null;
            })();

            const hasFs = Boolean(preloadApi?.filesystem?.exists && preloadApi?.filesystem?.createDirectory);
            const hasPath = Boolean(preloadApi?.path?.join);
            const hasElectron = Boolean(preloadApi?.electron);

            startupStage = "protocol-trust";
            setDomStatus("starting");
            this.trustInAccordProtocol();

            startupStage = "inject-styles";
            setDomStatus("starting");
            Logger.log("Startup", "Injecting ia Styles");
            DOMManager.ensureRoots();
            DOMManager.injectStyle("ia-stylesheet", Styles.toString());

            if (hasFs && hasPath) {
                startupStage = "addonstore";
                setDomStatus("starting");
                Logger.log("Startup", "Initializing AddonStore");
                const AddonStore = (await import("./addonstore")).default;
                AddonStore.initialize();
            }

            startupStage = "locales";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing LocaleManager");
            LocaleManager.initialize();

            startupStage = "settings";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing Settings");
            Settings.initialize();
            Settings.registerPanel("managerhub", "Manager Hub", {
                order: 0,
                icon: LayoutGridIcon,
                discordIcon: ManagerHubSplashIcon,
                element: ManagerHubPanel,
                searchable: () => ["plugin", "theme", "custom css", "manager"]
            });
            Settings.registerPanel("github", "GitHub", {
                order: 999,
                icon: GithubIcon,
                onClick: () => {
                    window.open("https://github.com/GARD-Realms-LLC/In-Accord-App", "_blank", "noopener,noreferrer");
                },
                searchable: () => ["github", "repo", "source", "inaccord"]
            });
            Settings.registerPanel("ourserver", "Our Server", {
                order: 1000,
                discordIcon: OurServerDiscordIcon,
                onClick: () => {
                    window.open("https://discord.com/channels/1418648743544094871", "_blank", "noopener,noreferrer");
                },
                searchable: () => ["discord", "server", "community", "our server"]
            });
            Settings.registerPanel("about", "About In-Accord", {
                order: 2001,
                icon: Info,
                element: AboutPanel,
                searchable: () => ["about", "info", "inaccord", "about inaccord"]
            });
            SettingsRenderer.initialize();

            startupStage = "dommanager";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing DOMManager");
            DOMManager.initialize();

            startupStage = "commandmanager";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing CommandManager");
            CommandManager.initialize();

            startupStage = "installcss";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing Internal InstallCSS");
            InstallCSS.initialize();

            startupStage = "floatingwindows";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing FloatingWindows");
            FloatingWindows.initialize();

            startupStage = "toasts";
            setDomStatus("starting");
            Logger.log("Startup", "Initializing Toasts");
            Toasts.initialize();
            ToastStore.info("In-Accord startup is running...", {forceShow: true, timeout: 8000});

            startupStage = "connection-wait";
            setDomStatus("starting");
            Logger.log("Startup", "Wiating for connection...");
            await this.wiatForConnection(4000);

            startupStage = "builtins";
            setDomStatus("starting");
            if (hasFs && hasPath && hasElectron) {
                Logger.log("Startup", "Initializing Builtins");
                const Builtins = await import("@builtins/builtins");
                for (const module in Builtins) {
                    (Builtins as any)[module]?.initialize?.();
                }
            }

            startupStage = "backups";
            setDomStatus("starting");
            let backupErrors: any = null;
            if (hasFs && hasPath) {
                Logger.log("Startup", "Loading Backups");
                const BackupManager = (await import("./backupmanager")).default;
                backupErrors = BackupManager.initialize();
            }

            startupStage = "plugins";
            setDomStatus("starting");
            let pluginErrors: any = null;
            if (hasFs && hasPath) {
                Logger.log("Startup", "Loading Plugins");
                const PluginManager = (await import("./pluginmanager")).default;
                pluginErrors = PluginManager.initialize();
            }

            startupStage = "themes";
            setDomStatus("starting");
            let themeErrors: any = null;
            if (hasFs && hasPath) {
                Logger.log("Startup", "Loading Themes");
                const ThemeManager = (await import("./thememanager")).default;
                themeErrors = ThemeManager.initialize();
            }

            startupStage = "updater";
            setDomStatus("starting");
            if (hasFs && hasPath && hasElectron) {
                Logger.log("Startup", "Initializing Updater");
                const Updater = (await import("./updater")).default;
                Updater.initialize();
            }

            startupStage = "loading-icon-hide";
            setDomStatus("starting");
            Logger.log("Startup", "Removing Loading Icon");
            LoadingIcon.hide();

            startupStage = "addon-error-modal";
            setDomStatus("starting");
            Logger.log("Startup", "Collecting Startup Errors");
            Modals.showAddonErrors({backup: backupErrors, plugins: pluginErrors, themes: themeErrors});

            startupStage = "changelog";
            setDomStatus("starting");
            try {
                if (hasFs && hasPath) {
                    const JsonStore = (await import("@stores/json")).default;
                    const previousVersion = JsonStore.get("misc", "version");
                    if (Config.get("version") !== previousVersion) {
                        Modals.showChangelogModal(Changelog);
                        JsonStore.set("misc", "version", Config.get("version"));
                    }
                }
            }
            catch {}

            startupStage = "done";
            setDomStatus("startup-complete");
            ToastStore.success("In-Accord startup complete.", {forceShow: true, timeout: 8000});
            this.startupAttempts = 0;
            if (this.startupRetryTimer) {
                clearTimeout(this.startupRetryTimer);
                this.startupRetryTimer = null;
            }
        }
        catch (error) {
            const stageMessage = `In-Accord startup failed at stage: ${startupStage}`;
            Logger.stacktrace("Startup", stageMessage, error as Error);
            try {
                setDomStatus("startup-error", {
                    "startup-error": stageMessage,
                    "startup-error-detail": (error as any)?.stack || (error as any)?.message || String(error)
                });
            }
            catch {}
            try {LoadingIcon.hide();} catch {}
            try {ToastStore.error(stageMessage, {forceShow: true, timeout: 12000});} catch {}
            try {
                Modals.default("In-Accord Startup Error", `${stageMessage}. Check logs for details.`);
            }
            catch {}

            this.hasStarted = false;
            if (this.startupAttempts < this.maxStartupAttempts) {
                const retryMs = Math.min(1000 + (this.startupAttempts * 500), 5000);
                Logger.log("Startup", `Retrying startup in ${retryMs}ms (attempt ${this.startupAttempts + 1}/${this.maxStartupAttempts})`);
                this.startupRetryTimer = setTimeout(() => {
                    this.startupRetryTimer = null;
                    void this.startup();
                }, retryMs);
            }
            else {
                Logger.error("Startup", `Startup retry limit reached (${this.maxStartupAttempts} attempts)`);
            }
        }
    }

    wiatForConnection(timeoutMs = 4000) {
        return new Promise<void>(done => {
            if (DiscordModules.UserStore?.getCurrentUser()) return done();

            let settled = false;
            const onConnectionOpen = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                try {
                    DiscordModules.Dispatcher?.unsubscribe("CONNECTION_OPEN", onConnectionOpen);
                }
                catch {}
                done();
            };

            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                try {
                    DiscordModules.Dispatcher?.unsubscribe("CONNECTION_OPEN", onConnectionOpen);
                }
                catch {}
                done();
            }, timeoutMs);

            DiscordModules.Dispatcher?.subscribe("CONNECTION_OPEN", onConnectionOpen);
        });
    }
};
