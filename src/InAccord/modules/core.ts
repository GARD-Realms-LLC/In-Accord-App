import Logger from "@common/logger";

import Config from "@stores/config";
import Changelog from "@data/changelog";

import * as Builtins from "@builtins/builtins";

import LoadingIcon from "../loadingicon";

import LocaleManager from "./localemanager";
import DOMManager from "./dommanager";
import BackupManager from "./backupmanager";
import PluginManager from "./pluginmanager";
import ThemeManager from "./thememanager";
import Settings from "@stores/settings";
import JsonStore from "@stores/json";
import DiscordModules from "./discordmodules";

import IPC from "./ipc";
import Updater from "./updater";
import AddonStore from "./addonstore";

import Styles from "@styles/index.css";
import Modals from "@ui/modals";
import FloatingWindows from "@ui/floatingwindows";
import Toasts from "@ui/toasts";
import SettingsRenderer from "@ui/settings";
import ManagerHubPanel from "@ui/settings/managerhub";
import CommandManager from "./commandmanager";
// import NotificationUI from "@ui/notifications";
import InstallCSS from "@ui/customcss/mdinstallcss";
import {getStore} from "@webpack";
import Patcher from "./patcher";
import {BriefcaseIcon, GithubIcon, LayoutGridIcon} from "lucide-react";
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

    trustInAccordProtocol() {
        Patcher.after("InAccordProtocol", getStore("MaskedLinkStore")!, "isTrustedProtocol", (_, [url]: any, ret) => ret || url.startsWith("inaccord://"));
    }

    async startup() {
        if (this.hasStarted) return;
        this.hasStarted = true;

        IPC.getSystemAccentColor().then(value => DOMManager.injectStyle("ia-os-values", `:root {--os-accent-color: #${value};}`));

        this.trustInAccordProtocol();

        // Load css early
        Logger.log("Startup", "Injecting ia Styles");
        DOMManager.injectStyle("ia-stylesheet", Styles.toString());

        Logger.log("Startup", "Initializing AddonStore");
        AddonStore.initialize();

        Logger.log("Startup", "Initializing LocaleManager");
        LocaleManager.initialize();

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
        SettingsRenderer.initialize();

        Logger.log("Startup", "Initializing DOMManager");
        DOMManager.initialize();

        Logger.log("Startup", "Initializing CommandManager");
        CommandManager.initialize();

        // Logger.log("Startup", "Initializing NotificationUI");
        // NotificationUI.initialize();

        Logger.log("Startup", "Initializing Internal InstallCSS");
        InstallCSS.initialize();

        Logger.log("Startup", "Wiating for connection...");
        await this.wiatForConnection();

        Logger.log("Startup", "Initializing FloatingWindows");
        FloatingWindows.initialize();

        Logger.log("Startup", "Initializing Toasts");
        Toasts.initialize();

        Logger.log("Startup", "Initializing Builtins");
        for (const module in Builtins) {
            Builtins[module as keyof typeof Builtins].initialize();
        }

        Logger.log("Startup", "Loading Backups");
        // const backupErrors = [];
        const backupErrors = BackupManager.initialize();

        Logger.log("Startup", "Loading Plugins");
        // const pluginErrors = [];
        const pluginErrors = PluginManager.initialize();

        Logger.log("Startup", "Loading Themes");
        // const themeErrors = [];
        const themeErrors = ThemeManager.initialize();

        Logger.log("Startup", "Initializing Updater");
        Updater.initialize();

        Logger.log("Startup", "Removing Loading Icon");
        LoadingIcon.hide();

        // Show loading errors
        Logger.log("Startup", "Collecting Startup Errors");
        Modals.showAddonErrors({backup: backupErrors, plugins: pluginErrors, themes: themeErrors});

        const previousVersion = JsonStore.get("misc", "version");
        if (Config.get("version") !== previousVersion) {
            Modals.showChangelogModal(Changelog);
            JsonStore.set("misc", "version", Config.get("version"));
        }
    }

    wiatForConnection() {
        return new Promise<void>(done => {
            if (DiscordModules.UserStore?.getCurrentUser()) return done();
            DiscordModules.Dispatcher?.subscribe("CONNECTION_OPEN", done);
        });
    }
};
