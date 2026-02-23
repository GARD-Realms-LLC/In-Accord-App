import React from "@modules/react";
import Divider from "@ui/divider";
import type {PropsWithChildren} from "react";


export type SettingItemProp = PropsWithChildren<{
    id: string;
    name?: string;
    note?: string;
    inline?: boolean;
}>;

export default function SettingItem({id, name, note, inline, children}: SettingItemProp) {
    return <div className={"ia-setting-item" + (inline ? " inline" : "")}>
        <div className={"ia-setting-header"}>
            <label htmlFor={id} className={"ia-setting-title"}>{name}</label>
            {inline && children}
        </div>
        <div className={"ia-setting-note"}>{note}</div>
        {!inline && children}
        <Divider className="ia-setting-divider" />
    </div>;
}