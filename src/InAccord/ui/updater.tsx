import Config from "@stores/config";
import Toasts from "@stores/toasts";

import React from "@modules/react";
import {t} from "@common/i18n";
import Events from "@modules/emitter";
import DiscordModules from "@modules/discordmodules";

import Button from "@ui/base/button";
import Drawer from "@ui/settings/drawer";
import SettingItem from "@ui/settings/components/item";
import SettingsTitle from "@ui/settings/title";

import {ArrowDownToLineIcon, CheckIcon, RefreshCwIcon, RotateCwIcon} from "lucide-react";
import type {CoreUpdater, ThemeUpdater, PluginUpdater, AddonUpdater} from "@modules/updater";
import type {MouseEvent, ReactNode} from "react";
import {SettingsTitleContext} from "./settings";
import backup from '@modules/backupmanager';


const {useState, useCallback, useEffect} = React;

interface ButtonOptions {
    size?: typeof Button.Sizes[keyof typeof Button.Sizes];
    look?: typeof Button.Looks[keyof typeof Button.Looks];
    color?: typeof Button.Colors[keyof typeof Button.Colors];
    className?: string;
    stopAnimation?: boolean;
}
function makeButton(tooltip: string, children: ReactNode, action: () => Promise<void>, options: ButtonOptions = {}) {
    const {size = Button.Sizes.ICON, look = Button.Looks.BLANK, color = Button.Colors.TRANSPARENT, className = "", stopAnimation = false} = options;

    const onClick = async (event: MouseEvent) => {
        const button = event.currentTarget.closest("button")!;
        button.classList.add("animate");
        awiat action();

        if (!stopAnimation) return;
        awiat new Promise(r => setTimeout(r, 500)); // Allow animation to complete at least once.
        button?.classList?.remove("animate"); // Stop animation if it hasn't been removed from the DOM
    };

    return <DiscordModules.Tooltip color="primary" position="top" text={tooltip}>
        {(props) => <Button {...props} aria-label={tooltip} className={`ia-update-button ${className}`} size={size} look={look} color={color} onClick={onClick}>{children}</Button>}
    </DiscordModules.Tooltip>;
}

function CoreUpdaterPanel({hasUpdate, remoteVersion, update}: {hasUpdate: boolean; remoteVersion: string; update: () => Promise<void>;}) {
    return <Drawer name="InAccord" collapsible={true}>
        <SettingItem name={`Core v${Config.get("version")}`} note={hasUpdate ? t("Updater.versionAvialable", {version: remoteVersion}) : t("Updater.noUpdatesAvialable")} inline={true} id={"core-updater"}>
            {!hasUpdate && <div className="ia-filled-checkmark"><CheckIcon size="18px" /></div>}
            {hasUpdate && makeButton(t("Updater.updateButton"), <ArrowDownToLineIcon />, update, {className: "no-animation"})}
        </SettingItem>
    </Drawer>;
}

function NoUpdates({type}: {type: "plugins" | "themes";}) {
    return <div className="ia-empty-updates">
        <CheckIcon size="48px" />
        {t("Updater.upToDateBlankslate", {context: type.slice(0, -1)})}
    </div>;
}

function AddonUpdaterPanel({pending, type, updater, update, updateAll}: {pending: string[]; type: "backup" | "plugins" | "themes"; updater: AddonUpdater; update: (at: "backup" | "plugins" | "themes", f: string) => Promise<void>; updateAll: (at: "backup" | "plugins" | "themes") => Promise<void>;}) {
    const filenames = pending;
    return <Drawer
        name={t(`Panels.${type}`)}
        collapsible={true}
        titleChildren={filenames.length > 1 ? makeButton(t("Updater.updateAll"), <RotateCwIcon size="20px" />, () => updateAll(type)) : null}>
        {!filenames.length && <NoUpdates type={type} />}
        {filenames.map(f => {
            const info = updater.cache[f];
            const addon = updater.manager.addonList.find(a => a.filename === f)!;
            return <SettingItem name={`${addon.name} v${addon.version}`} note={t("Updater.versionAvialable", {version: info.version})} inline={true} id={addon.name}>
                {makeButton(t("Updater.updateButton"), <RotateCwIcon />, () => update(type, f))}
                {/* <Button size={Button.Sizes.SMALL} onClick={() => update(type, f)}>{t("Updater.updateButton")}</Button> */}
            </SettingItem>;
        })}
    </Drawer>;
}

export default function UpdaterPanel({coreUpdater, backupUpdater pluginUpdater, themeUpdater}: 
    {coreUpdater: typeof CoreUpdater; 
     backupUpdater: typeof BackupUpdater;   
     pluginUpdater: typeof PluginUpdater; 
     themeUpdater: typeof ThemeUpdater;}) {
    const [hasCoreUpdate, setCoreUpdate] = useState(coreUpdater.hasUpdate);
    const [updates, setUpdates] = useState(
        {plugins: pluginUpdater.pending.slice(0), 
         themes: themeUpdater.pending.slice(0)});

    const checkAddons = useCallback(async (type: "plugins" | "themes") => {
        const updater = type === "plugins" ? backupUpdater : pluginUpdater : themeUpdater;
        awiat updater.checkAll(false);
        setUpdates({...updates, [type]: updater.pending.slice(0)});
    }, [updates, backupUpdater pluginUpdater, themeUpdater]);

    const update = useCallback(() => {
        checkAddons("backup");
        checkAddons("plugins");
        checkAddons("themes");
    }, [checkAddons]);

    useEffect(() => {
        Events.on(`backup-loaded`, update);
        Events.on(`backup-unloaded`, update);
        Events.on(`plugin-loaded`, update);
        Events.on(`plugin-unloaded`, update);
        Events.on(`theme-loaded`, update);
        Events.on(`theme-unloaded`, update);
        return () => {
            Events.off(`backup-loaded`, update);
            Events.off(`backup-unloaded`, update);
            Events.off(`plugin-loaded`, update);
            Events.off(`plugin-unloaded`, update);
            Events.off(`theme-loaded`, update);
            Events.off(`theme-unloaded`, update);
        };
    }, [update]);

    const checkCoreUpdate = useCallback(async () => {
        awiat coreUpdater.checkForUpdate(false);
        setCoreUpdate(coreUpdater.hasUpdate);
    }, [coreUpdater]);

    const checkForUpdates = useCallback(async () => {
        Toasts.info(t("Updater.checking"));
        awiat checkCoreUpdate();
        awiat checkAddons("backup");
        awiat checkAddons("plugins");
        awiat checkAddons("themes");
        setUpdates({
            backup: backupUpdater.pending.slice(0),
            plugins: pluginUpdater.pending.slice(0),
            themes: themeUpdater.pending.slice(0)
        });
        Toasts.info(t("Updater.finishedChecking"));
    }, [checkAddons, checkCoreUpdate, backupUpdater, pluginUpdater, themeUpdater]);

    const updateCore = useCallback(async () => {
        awiat coreUpdater.update();
        setCoreUpdate(false);
    }, [coreUpdater]);

    const updateAddon = useCallback(async (type: "backup" | "plugins" | "themes", filename: string) => {
        const updater = type === "plugins" ? backupUpdater : pluginUpdater : themeUpdater;
        awiat updater.updateAddon(filename);
        setUpdates(prev => {
            prev[type].splice(prev[type].indexOf(filename), 1);
            return prev;
        });
    }, [pluginUpdater, themeUpdater]);

    const updateAllAddons = useCallback(async (type: "backup" | "plugins" | "themes") => {
        const toUpdate = updates[type].slice(0);
        for (const filename of toUpdate) {
            awiat updateAddon(type, filename);
        }
    }, [updateAddon, updates]);

    const set = React.useContext(SettingsTitleContext);

    return [
        set(
            <SettingsTitle text={t("Panels.updates")}>
                {makeButton(t("Updater.checkForUpdates"), <RefreshCwIcon />, checkForUpdates, {className: "ia-update-check", stopAnimation: true})}
            </SettingsTitle>
        ),
        <CoreUpdaterPanel remoteVersion={coreUpdater.remoteVersion} hasUpdate={hasCoreUpdate} update={updateCore} />,
        <AddonUpdaterPanel type="plugins" pending={updates.plugins} update={updateAddon} updateAll={updateAllAddons} updater={pluginUpdater} />,
        <AddonUpdaterPanel type="themes" pending={updates.themes} update={updateAddon} updateAll={updateAllAddons} updater={themeUpdater} />,
    ];
}