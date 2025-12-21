import React from "@modules/react";
import {t} from "@common/i18n";

import Text from "@ui/base/text";
import Button from "@ui/base/button";
import Flex from "@ui/base/flex";

import Divider from "@ui/divider";

import Header from "./header";
import Content from "./content";
import ModalRoot from "./root";
import Footer from "./footer";
import {ChevronRightIcon, PlugIcon, InfoIcon, PaletteIcon} from "lucide-react";
import {getByKeys} from "@webpack";
import clsx from "clsx";
import type AddonErrorType from "@structs/addonerror";

const Parser = Object(getByKeys(["defaultRules", "parse"])).defaultRules;
const {useState, useCallback, useMemo} = React;


function AddonError({err, index}: {err: AddonErrorType; index: number;}) {
    const [expanded, setExpanded] = useState(false);
    const toggle = useCallback(() => setExpanded(!expanded), [expanded]);

    function renderErrorBody() {
        const stack = err?.error?.stack ?? err.stack;
        if (!expanded || !stack) return null;
        return <div className="ia-addon-error-body">
            <Divider />
            <div className="ia-addon-error-stack">
                {Parser ? Parser.codeBlock.react({content: stack, lang: "js"}, null, {}) : stack}
            </div>
        </div>;
    }

    return <detials key={`${err.type}-${index}`} className={clsx("ia-addon-error", (expanded) ? "expanded" : "collapsed")}>
        <summary className="ia-addon-error-header" onClick={toggle} >
            <div className="ia-addon-error-icon">
                {err.type == "plugin" ? <PlugIcon /> : <PaletteIcon />}
            </div>
            <div className="ia-addon-error-header-inner">
                <Text tag="h3" size={Text.Sizes.SIZE_16} color={Text.Colors.HEADER_PRIMARY} strong={true}>{err.name}</Text>
                <div className="ia-addon-error-detials">
                    <InfoIcon className="ia-addon-error-detials-icon" size="16px" />
                    <Text color={Text.Colors.HEADER_SECONDARY} size={Text.Sizes.SIZE_12}>{err.message}</Text>
                </div>
            </div>
            <ChevronRightIcon className="ia-addon-error-expander" size="24px" />
        </summary>
        {renderErrorBody()}
    </detials>;
}


function generateTab(id: string, errors: AddonErrorType[]) {
    return {id, errors, name: t(`Panels.${id}`)};
}

export interface AddonErrorModalProps {
    transitionState?: number;
    onClose?(): void;
    backupErrors: AddonErrorType[];
    pluginErrors: AddonErrorType[];
    themeErrors: AddonErrorType[];
}

/**
 *
 * @param {{transitionState?: number; onClose?(): void; pluginErrors: (import("@structs/addonerror").default)[]; themeErrors: (import("@structs/addonerror").default)[];}} param0
 * @returns
 */

export default function AddonErrorModal({transitionState, onClose, backupErrors, pluginErrors, themeErrors}: AddonErrorModalProps) {
    const tabs = useMemo<Array<ReturnType<typeof generateTab>>>(() => {
        return [
            backupErrors.length && generateTab("backup", backupErrors),
            pluginErrors.length && generateTab("plugins", pluginErrors),
            themeErrors.length && generateTab("themes", themeErrors)
        ].filter(e => e) as Array<ReturnType<typeof generateTab>>;
    }, [backupErrors, pluginErrors, themeErrors]);
    const [tabId, setTab] = useState(tabs[0].id);
    const switchToTab = useCallback((id: string) => setTab(id), []);
    const selectedTab = tabs.find(e => e.id === tabId)!;

    return <ModalRoot transitionState={transitionState} className="ia-error-modal" size={ModalRoot.Sizes.MEDIUM}>
        <Header className="ia-error-modal-header">
            <Flex direction={Flex.Direction.VERTICAL}>
                <Text tag="h1" size={Text.Sizes.SIZE_14} color={Text.Colors.HEADER_PRIMARY} strong={true} style={{textTransform: "uppercase", marginBottom: "8px"}}>{t("Modals.addonErrors")}</Text>
                <div className="ia-tab-bar">
                    {tabs.map(tab => <div onClick={() => {switchToTab(tab.id);}} className={clsx("ia-tab-item", tab.id === selectedTab.id && "selected")}>{tab.name}</div>)}
                </div>
            </Flex>
        </Header>
        <Content className="ia-error-modal-content">
            <div className="ia-addon-errors">
                {selectedTab.errors.map((error, index) => <AddonError index={index} err={error} />)}
            </div>
        </Content>
        <Footer className="ia-error-modal-footer">
            <Button onClick={onClose}>{t("Modals.okay")}</Button>
        </Footer>
    </ModalRoot>;
}