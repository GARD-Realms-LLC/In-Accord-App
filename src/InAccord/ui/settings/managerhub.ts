import React from "@modules/react";
import IPC from "@modules/ipc";
import BackupManager from "@modules/backupmanager";
import PluginManager from "@modules/pluginmanager";
import ThemeManager from "@modules/thememanager";
import SettingsStore from "@stores/settings";
import Config from "@stores/config";
import SettingsRenderer, {SettingsTitleContext} from "@ui/settings";
import SettingsTitle from "@ui/settings/title";
import Button from "@ui/base/button";
import Text from "@ui/base/text";
import {CustomCSS} from "@builtins/builtins";
import {useStateFromStores} from "@ui/hooks";
import {t} from "@common/i18n";

interface AddonManagerLike {
    addonList: Array<{id: string;}>;
    state: Record<string, boolean>;
}

function getAddonStats(manager: AddonManagerLike) {
    const total = manager.addonList.length;
    const enabled = manager.addonList.reduce((count, addon) => count + (manager.state[addon.id] ? 1 : 0), 0);

    return {total, enabled};
}

interface HubCardProps {
    icon: any;
    title: string;
    subtitle: string;
    onOpen(): void;
    onToggle?(): void;
    onOpenFolder?(): void;
    buttonColor: typeof Button.Colors[keyof typeof Button.Colors];
    toggleLabel?: string;
}

function HubCard({icon, title, subtitle, onOpen, onToggle, onOpenFolder, buttonColor, toggleLabel}: HubCardProps) {
    return React.createElement("div", {className: "ia-manager-hub-card"},
        React.createElement("div", {className: "ia-manager-hub-card-header"},
            React.createElement("div", {className: "ia-manager-hub-icon"}, icon),
            React.createElement("div", {},
                React.createElement(Text, {strong: true, size: Text.Sizes.SIZE_16}, title),
                React.createElement(Text, {color: Text.Colors.MUTED, size: Text.Sizes.SIZE_12}, subtitle)
            )
        ),
        React.createElement("div", {className: "ia-manager-hub-card-actions"}, [
            React.createElement(Button, {size: Button.Sizes.SMALL, color: buttonColor, onClick: onOpen}, "Open"),
            onToggle && React.createElement(Button, {size: Button.Sizes.SMALL, color: Button.Colors.PRIMARY, look: Button.Looks.OUTLINED, onClick: onToggle}, toggleLabel || "Toggle"),
            onOpenFolder && React.createElement(Button, {size: Button.Sizes.SMALL, color: Button.Colors.PRIMARY, look: Button.Looks.OUTLINED, onClick: onOpenFolder}, "Folder")
        ])
    );
}

export default function ManagerHubPanel() {
    const set = React.useContext(SettingsTitleContext);

    const backupStats = getAddonStats(BackupManager as unknown as AddonManagerLike);
    const pluginStats = useStateFromStores(PluginManager, () => getAddonStats(PluginManager), [], true);
    const themeStats = useStateFromStores(ThemeManager, () => getAddonStats(ThemeManager), [], true);
    const customCssEnabled = useStateFromStores(SettingsStore, () => SettingsStore.get<boolean>("settings", "customcss", "customcss"));

    const allPluginsEnabled = pluginStats.total > 0 && pluginStats.enabled === pluginStats.total;
    const allThemesEnabled = themeStats.total > 0 && themeStats.enabled === themeStats.total;

    return [
        set(React.createElement(SettingsTitle, {text: t("Panels.managerhub") || "Manager Hub"})),
        React.createElement("div", {className: "ia-manager-hub"}, [
            React.createElement("h2", {className: "ia-manager-hub-heading"}, "In-Accord"),
            React.createElement(Text, {className: "ia-manager-hub-description", color: Text.Colors.MUTED},
                "Manage your Discord customization tools from one place."
            ),
            React.createElement("div", {className: "ia-manager-hub-backup"},
                React.createElement(Text, {color: Text.Colors.MUTED, size: Text.Sizes.SIZE_12},
                    `Backups: ${backupStats.enabled}/${backupStats.total} ${t("Addons.isEnabled")}`
                ),
                React.createElement(Button, {
                    size: Button.Sizes.SMALL,
                    color: Button.Colors.PRIMARY,
                    look: Button.Looks.OUTLINED,
                    onClick: () => IPC.openPath(Config.get("backupPath"))
                }, "Backup Folder")
            ),
            React.createElement("div", {className: "ia-manager-hub-grid"}, [
                React.createElement(HubCard, {
                    icon: React.createElement(Text, {size: Text.Sizes.SIZE_16}, "🔌"),
                    title: t("Panels.plugins"),
                    subtitle: `${pluginStats.enabled}/${pluginStats.total} ${t("Addons.isEnabled")}`,
                    onOpen: () => SettingsRenderer.openSettingsPage("plugins"),
                    onToggle: () => allPluginsEnabled ? PluginManager.disableAllAddons() : PluginManager.enableAllAddons(),
                    onOpenFolder: () => IPC.openPath(PluginManager.addonFolder),
                    toggleLabel: allPluginsEnabled ? "Disable all" : "Enable all",
                    buttonColor: Button.Colors.BLURPLE
                }),
                React.createElement(HubCard, {
                    icon: React.createElement(Text, {size: Text.Sizes.SIZE_16}, "🎨"),
                    title: t("Panels.themes"),
                    subtitle: `${themeStats.enabled}/${themeStats.total} ${t("Addons.isEnabled")}`,
                    onOpen: () => SettingsRenderer.openSettingsPage("themes"),
                    onToggle: () => allThemesEnabled ? ThemeManager.disableAllAddons() : ThemeManager.enableAllAddons(),
                    onOpenFolder: () => IPC.openPath(ThemeManager.addonFolder),
                    toggleLabel: allThemesEnabled ? "Disable all" : "Enable all",
                    buttonColor: Button.Colors.BRAND
                }),
                React.createElement(HubCard, {
                    icon: React.createElement(Text, {size: Text.Sizes.SIZE_16}, "✏️"),
                    title: t("Panels.customcss"),
                    subtitle: customCssEnabled ? "Enabled" : "Disabled",
                    onOpen: () => CustomCSS.open(),
                    onToggle: () => SettingsStore.set("settings", "customcss", "customcss", !customCssEnabled),
                    onOpenFolder: () => IPC.openPath(Config.get("channelPath")),
                    toggleLabel: customCssEnabled ? "Disable" : "Enable",
                    buttonColor: customCssEnabled ? Button.Colors.GREEN : Button.Colors.YELLOW
                })
            ])
        ])
    ];
}
