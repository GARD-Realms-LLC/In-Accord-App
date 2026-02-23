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
import type {MouseEvent, ReactNode} from "react";
import {SettingsTitleContext} from "./settings";


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
        const button = (event.currentTarget as HTMLElement).closest("button") as HTMLButtonElement;
        button?.classList?.add("animate");
        await action();

        if (!stopAnimation) return;
        await new Promise(r => setTimeout(r, 500));
        button?.classList?.remove("animate");
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

function AddonUpdaterPanel({pending, type, updater, update, updateAll}: {
    pending: string[];
    type: "plugins" | "themes";
    updater: any;
    update: (at: "plugins" | "themes", f: string) => Promise<void>;
    updateAll: (at: "plugins" | "themes") => Promise<void>;
}) {
    const filenames = pending;

    return <Drawer
        name={t(`Panels.${type}`)}
        collapsible={true}
        titleChildren={filenames.length > 1 ? makeButton(t("Updater.updateAll"), <RotateCwIcon size="20px" />, () => updateAll(type)) : null}>
        {!filenames.length && <NoUpdates type={type} />}
        {filenames.map((f) => {
            const info = updater.cache[f];
            const addon = updater.manager.addonList.find((a: any) => a.filename === f)!;
            return <SettingItem name={`${addon?.name ?? f} v${addon?.version ?? "?"}`} note={t("Updater.versionAvialable", {version: info?.version ?? "?"})} inline={true} id={addon?.name ?? f}>
                {makeButton(t("Updater.updateButton"), <RotateCwIcon />, () => update(type, f))}
            </SettingItem>;
        })}
    </Drawer>;
}

export default function UpdaterPanel({coreUpdater, backupUpdater, pluginUpdater, themeUpdater}: {
    coreUpdater: any;
    backupUpdater: any;
    pluginUpdater: any;
    themeUpdater: any;
}) {
    void backupUpdater;

    const [hasCoreUpdate, setCoreUpdate] = useState(Boolean(coreUpdater.hasUpdate));
    const [updates, setUpdates] = useState({
        plugins: pluginUpdater.pending.slice(0),
        themes: themeUpdater.pending.slice(0)
    });

    const checkAddons = useCallback(async (type: "plugins" | "themes") => {
        const updater = type === "plugins" ? pluginUpdater : themeUpdater;
        await updater.checkAll(false);
        setUpdates(prev => ({...prev, [type]: updater.pending.slice(0)}));
    }, [pluginUpdater, themeUpdater]);

    const refreshList = useCallback(() => {
        checkAddons("plugins");
        checkAddons("themes");
    }, [checkAddons]);

    useEffect(() => {
        Events.on("plugin-loaded", refreshList);
        Events.on("plugin-unloaded", refreshList);
        Events.on("theme-loaded", refreshList);
        Events.on("theme-unloaded", refreshList);

        return () => {
            Events.off("plugin-loaded", refreshList);
            Events.off("plugin-unloaded", refreshList);
            Events.off("theme-loaded", refreshList);
            Events.off("theme-unloaded", refreshList);
        };
    }, [refreshList]);

    const checkCoreUpdate = useCallback(async () => {
        await coreUpdater.checkForUpdate(false);
        setCoreUpdate(Boolean(coreUpdater.hasUpdate));
    }, [coreUpdater]);

    const checkForUpdates = useCallback(async () => {
        Toasts.info(t("Updater.checking"));
        await checkCoreUpdate();
        await checkAddons("plugins");
        await checkAddons("themes");
        Toasts.info(t("Updater.finishedChecking"));
    }, [checkAddons, checkCoreUpdate]);

    const updateCore = useCallback(async () => {
        await coreUpdater.update();
        setCoreUpdate(false);
    }, [coreUpdater]);

    const updateAddon = useCallback(async (type: "plugins" | "themes", filename: string) => {
        const updater = type === "plugins" ? pluginUpdater : themeUpdater;
        await updater.updateAddon(filename);
        setUpdates(prev => ({
            ...prev,
            [type]: prev[type].filter((f: string) => f !== filename)
        }));
    }, [pluginUpdater, themeUpdater]);

    const updateAllAddons = useCallback(async (type: "plugins" | "themes") => {
        const toUpdate = updates[type].slice(0);
        for (const filename of toUpdate) {
            await updateAddon(type, filename);
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
