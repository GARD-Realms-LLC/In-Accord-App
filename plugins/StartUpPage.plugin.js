/**
 * @name StartUpPage
 * @version 1.2
 * @description StartUpPage lets you choose which page Discord opens to on startup.
 * @author DevEvil
 * @website https://devevil.com
 * @invite jsQ9UP7kCA
 * @authorId 468132563714703390
 * @donate https://devevil.com/dnt
 * @source https://github.com/DevEvil99/StartUpPage-BetterDiscord-Plugin
 * @updateUrl https://raw.githubusercontent.com/DevEvil99/StartUpPage-BetterDiscord-Plugin/main/StartUpPage.plugin.js
 */

const config = {
    info: {
        name: "StartUpPage",
        version: "1.2",
        description: "StartUpPage lets you choose which page Discord opens to on startup.",
        authors: [{
            name: "DevEvil",
            discord_id: "468132563714703390",
            github_username: "DevEvil99"
        }],
        website: "https://devevil.com",
        github: "https://github.com/DevEvil99/StartUpPage-BetterDiscord-Plugin",
        github_raw: "https://raw.githubusercontent.com/DevEvil99/StartUpPage-BetterDiscord-Plugin/main/StartUpPage.plugin.js",
        invite: "jsQ9UP7kCA",
    }
};

const { Data, UI, Webpack, React } = BdApi;

class StartUpPage {
    constructor() {
        this.defaultSettings = {
            startupPage: "friends",
            dmChannelId: "",
            serverId: "",
            channelServerId: "",
            channelChannelId: "",
            discoveryPage: "servers",
            settingsPage: "account"
        };
        this.settings = this.loadSettings();
        this.availablePages = {
            "friends": "Friends",
            "dm": "Direct Message/Group",
            "server": "Server",
            "channel": "Channel",
            "settings": "Settings",
            "family": "Family Center",
            "discover": "Discover",
            "nitro": "Nitro",
            "shop": "Shop"
        };
        this.hasNavigated = false;
        this.isActive = false;
    }

    loadSettings() {
        try {
            const saved = Data.load("StartUpPage", "settings") || {};
            return Object.assign({}, this.defaultSettings, saved);
        } catch (err) {
            UI.showToast("Failed to load settings", { type: "error" });
            return this.defaultSettings;
        }
    }

    saveSettings() {
        try {
            Data.save("StartUpPage", "settings", this.settings);
        } catch (err) {
            UI.showToast("Failed to save settings", { type: "error" });
        }
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.navigateToStartupPage();
        this.showChangelogIfNeeded();
    }

    stop() {
        this.hasNavigated = false;
        this.isActive = false;
    }

    navigateToStartupPage() {
        const targetPath = this.getTargetPagePath();
        const currentPath = window.location.pathname;

        if (currentPath === targetPath || this.hasNavigated) return;

        this.hasNavigated = true;

        const transitionTo = Webpack.getByStrings(["transitionTo - Transitioning to"],{ searchExports: true });

        try {
            if (transitionTo) {
                transitionTo(targetPath);
                UI.showToast(`Navigated to ${this.availablePages[this.settings.startupPage] || "Channel"}`, { type: "success" });
            } else {
                window.location.pathname = targetPath;
                UI.showToast(`Using fallback | Navigated to ${this.availablePages[this.settings.startupPage] || "Channel"}`, { type: "success" });
            }
        } catch (err) {
            UI.showToast("Failed to navigate to startup page", { type: "error" });
        }
    }

    getTargetPagePath() {
        const validID = (id) => /^\d+$/.test(id.trim());

        switch (this.settings.startupPage) {
            case "friends":
                return "/channels/@me";
            case "discover":
                switch (this.settings.discoveryPage) {
                    case "servers":
                        return "/discovery/servers";
                    case "applications":
                        return "/discovery/applications";
                    case "quests":
                        return "/discovery/quests";
                    default:
                        return "/discovery/servers";
                }
            case "settings":
                switch (this.settings.settingsPage) {
                    case "account":
                        return "/settings/account";
                    case "profiles":
                        return "/settings/profile-customization";
                    case "appearance":
                        return "/settings/appearance";
                    case "accessibility":
                        return "/settings/accessibility";
                    case "family-settings":
                        return "/settings/family-center";
                    case "devices":
                        return "/settings/sessions";
                    case "subs":
                        return "/settings/subscriptions";
                    default:
                        return "/settings/account";
                }
            case "family":
                return "/family-center";
            case "nitro":
                return "/store";
            case "shop":
                return "/shop";
            case "dm":
                const dmChannelId = this.settings.dmChannelId.trim();
                if (validID(dmChannelId)) {
                    return `/channels/@me/${dmChannelId}`;
                }
                UI.showToast("Invalid DM channel ID, using default page", { type: "error" });
                return "/channels/@me";
            case "server":
                const serverId = this.settings.serverId.trim();
                if (validID(serverId)) {
                    return `/channels/${serverId}`;
                }
                UI.showToast("Invalid server ID, using default page", { type: "error" });
                return "/channels/@me";
            case "channel":
                const channelServerId = this.settings.channelServerId.trim();
                const channelChannelId = this.settings.channelChannelId.trim();
                if (validID(channelServerId) && validID(channelChannelId)) {
                    return `/channels/${channelServerId}/${channelChannelId}`;
                }
                UI.showToast("Invalid server or channel ID, using default page", { type: "error" });
                return "/channels/@me";
            default:
                return "/channels/@me";
        }
    }

    getSettingsPanel() {
        const GuildStore = Webpack.getModule(m => m.getGuilds && m.getGuild);
        const guilds = GuildStore ? GuildStore.getGuilds() : {};
        const serverOptions = Object.values(guilds).map(guild => ({
            label: guild.name,
            value: guild.id
        }));

        const SettingsContent = () => {
            return React.createElement("div", {
                style: { position: "relative" }
            },
                React.createElement("svg", {
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    width: "24",
                    height: "24",
                    fill: "var(--interactive-normal)",
                    style: {
                        position: "absolute",
                        top: "40px",
                        right: "0",
                        margin: "0 10px 0 10px",
                        cursor: "pointer"
                    },
                    onClick: () => this.openHelpModal()
                },
                    React.createElement("path", {
                        d: "M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.008-3.018a1.502 1.502 0 0 1 2.522 1.159v.024a1.44 1.44 0 0 1-1.493 1.418 1 1 0 0 0-1.037.999V14a1 1 0 1 0 2 0v-.539a3.44 3.44 0 0 0 2.529-3.256 3.502 3.502 0 0 0-7-.255 1 1 0 0 0 2 .076c.014-.398.187-.774.48-1.044Zm.982 7.026a1 1 0 1 0 0 2H12a1 1 0 1 0 0-2h-.01Z"
                    })
                ),
                UI.buildSettingsPanel({
                    settings: [
                        {
                            type: "dropdown",
                            id: "startupPage",
                            name: "Startup Page",
                            note: "Select the page Discord opens to when you launch the app. Click the ? icon for detailed instructions.",
                            value: this.settings.startupPage,
                            options: Object.entries(this.availablePages).map(([value, label]) => ({ label, value })),
                            onChange: (value) => {
                                this.settings.startupPage = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "category",
                            id: "userID",
                            name: "Direct Message/Group Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "dmChannelId",
                                    name: "DM/Group Channel ID",
                                    note: "Enter the Channel ID for a specific Direct Message or Group (e.g., 850270898756911144). Only applies if \"Direct Message/Group\" is selected as the Startup Page.",
                                    value: this.settings.dmChannelId,
                                    placeholder: "Channel ID",
                                    onChange: (value) => {
                                        this.settings.dmChannelId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "serverID",
                            name: "Server Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "dropdown",
                                    id: "serverId",
                                    name: "Server Selection",
                                    note: "Choose a server to open on startup from the dropdown. Only applies if \"Server\" is selected as the Startup Page. Your joined servers are automatically listed.",
                                    value: this.settings.serverId,
                                    options: serverOptions.length ? serverOptions : [{ label: "No servers available", value: "" }],
                                    onChange: (value) => {
                                        this.settings.serverId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "server_channelID",
                            name: "Channel Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "dropdown",
                                    id: "channelServerId",
                                    name: "Server Selection",
                                    note: "Choose the server containing the channel you want to open on startup. Only applies if \"Channel\" is selected as the Startup Page.",
                                    value: this.settings.channelServerId,
                                    options: serverOptions.length ? serverOptions : [{ label: "No servers available", value: "" }],
                                    onChange: (value) => {
                                        this.settings.channelServerId = value;
                                        this.saveSettings();
                                    }
                                },
                                {
                                    type: "text",
                                    id: "channelChannelId",
                                    name: "Channel ID",
                                    note: "Enter the Channel ID for a specific channel in the selected server (e.g., 844622406157205584). Only applies if \"Channel\" is selected as the Startup Page.",
                                    value: this.settings.channelChannelId,
                                    placeholder: "Channel ID",
                                    onChange: (value) => {
                                        this.settings.channelChannelId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "discovery_options",
                            name: "Discovery Page",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "radio",
                                    id: "discoveryPage",
                                    name: "Discovery Page",
                                    note: "Choose which discovery page to load when using \"Discover\" as your startup page.",
                                    value: this.settings.discoveryPage,
                                    options: [
                                        { name: "Servers", value: "servers" },
                                        { name: "Applications", value: "applications" },
                                        { name: "Quests", value: "quests" }
                                    ],
                                    onChange: (value) => {
                                        this.settings.discoveryPage = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "settings_options",
                            name: "Settings Page",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "radio",
                                    id: "settingsPage",
                                    name: "Settings Page",
                                    note: "Choose which settings page to load when using \"Settings\" as your startup page.",
                                    value: this.settings.settingsPage,
                                    options: [
                                        { name: "My Account", value: "account" },
                                        { name: "Profiles", value: "profiles" },
                                        { name: "Family Center", value: "family-settings" },
                                        { name: "Devices", value: "devices" },
                                        { name: "Subscriptions", value: "subs" },
                                        { name: "Appearance", value: "appearance" },
                                        { name: "Accessibility", value: "accessibility" }
                                    ],
                                    onChange: (value) => {
                                        this.settings.settingsPage = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        }
                    ],
                    onChange: (category, id, name, value) => {
                        UI.showToast(`Updated ${name}! Restart/Reload Discord to apply.`, { type: "success" });
                    }
                })
            );
        };

        return React.createElement(SettingsContent);
    }

    openHelpModal() {
        const HelpContent = () => {
            return React.createElement("div", null,
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "How to Use StartUpPage"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Select your preferred startup page from the \"Startup Page\" dropdown to customize where Discord opens on launch."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Direct Message/Group,\" enter the Channel ID in the \"Direct Message/Group Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Server,\" choose a server from the dropdown in the \"Server Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Channel,\" select a server and enter the Channel ID in the \"Channel Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Save changes and restart Discord to apply your startup page.")
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "How to Get IDs"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Enable Developer Mode (User Settings > Advanced > Developer Mode) to copy IDs by right-clicking users, servers, channels, or group DMs. Then select \"Copy Server ID\" for servers, and \"Copy Channel ID\" for channels, dms and groups.")
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "Startup Page Options"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Friends: "), "Opens the Friends tab, displaying your online friends and Direct Messages."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Direct Message/Group: "), "Opens a specific Direct Message or Group."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Server: "), "Opens a specific server."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Channel: "), "Opens a specific channel within a server."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Discover: "), "Opens to the Server Discovery page for finding new communities."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Nitro: "), "Opens to the Nitro store page for subscription features."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Shop: "), "Opens to the Discord shop for purchasing avatar decoration, profile effect, and etc."
                    )
                )
            );
        };

        UI.showConfirmationModal(
            "StartUpPage Guide",
            React.createElement(HelpContent),
            {
                confirmText: "Close",
                cancelText: null
            }
        );
    }

    showChangelog() {
        const changes = [
            {
                title: "Version 1.2",
                type: "added",
                items: [
                    "Added **Settings** and **Family Center** as new startup page options.",
                    "Added a \"Settings Page\" setting that allows you to choose which specific settings page loads when \"Settings\" is set as the startup page."
                ]
            },
            {
                title: "Version 1.1",
                type: "added",
                items: [
                    "Added a \"Discovery Page\" setting that allows you to choose which specific discovery page(Servers, Applications, Quests) loads when \"Discover\" is set as the startup page."
                ]
            },
            {
                title: "Version 1.0",
                type: "added",
                items: [
                    "Hello World! Thank you for using StartUpPage."
                ]
            }
        ];

        const options = {
            title: "StartUpPage Plugin",
            subtitle: "By DevEvil",
            changes: changes,
        };

        UI.showChangelogModal({
            title: options.title,
            subtitle: options.subtitle,
            changes: options.changes
        });
    }

    showChangelogIfNeeded() {
        const lastVersion = Data.load("StartUpPage", "lastVersion");
        if (lastVersion !== config.info.version) {
            this.showChangelog();
            Data.save("StartUpPage", "lastVersion", config.info.version);
        }
    }
}

module.exports = class extends StartUpPage {
    constructor() {
        super();
    }
};
