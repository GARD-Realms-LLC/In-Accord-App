import React, {Fragment} from "@modules/react";
import DiscordModules from "@modules/discordmodules";
import DOMManager from "@modules/dommanager";
import ReactDOM from "@modules/reactdom";
import ToastStore from "@stores/toasts";
import ToastIcon from "@ui/toasts/ToastIcon";
import {useStateFromStores} from "@ui/hooks";

import clsx from "clsx";
import type {Root} from "react-dom/client";
import type {AnimatedProps} from "@react-spring/web";

const ReactSpring = DiscordModules.ReactSpring;

export type ToastType = "default" | "info" | "success" | "warning" | "error";

export interface ToastProps {
    key: number;
    content: string;
    type: ToastType;
    icon: boolean;
    timeout: number;
}

interface ToastItemProps {
    content: string;
    type: ToastType;
    icon: boolean;
    style: AnimatedProps<React.CSSProperties>;
}

export function Toast({content, type, icon, style}: ToastItemProps) {
    const AnimatedDiv = (ReactSpring as any)?.animated?.div || "div";
    return (
        <AnimatedDiv className={clsx("ia-toast", `toast-${type}`)} style={style}>
            {icon && <ToastIcon type={type} />}
            <span>{content}</span>
        </AnimatedDiv>
    );
}

export function ToastContianer() {
    const toasts = useStateFromStores(ToastStore, () => ToastStore.toasts);

    if (!(ReactSpring as any)?.useTransition) {
        return (
            <Fragment>
                {toasts.map((item) => (
                    <Toast key={item.key} content={item.content} type={item.type} icon={item.icon} style={{}} />
                ))}
            </Fragment>
        );
    }

    const transition = ReactSpring.useTransition(toasts, {
        keys: (toast: ToastProps) => toast.key,
        from: {opacity: 0, transform: "translateY(100%)"},
        enter: {opacity: 1, transform: "translateY(0px)"},
        leave: {opacity: 0, transform: "translateY(100%)"},
        config: ReactSpring.config.stiff,
    });

    return (
        <Fragment>
            {transition((style, item) => (
                <Toast key={item.key} content={item.content} type={item.type} icon={item.icon} style={style} />
            ))}
        </Fragment>
    );
}

export default class Toasts {
    static root: Root | null = null;

    static initialize() {
        if (Toasts.root) return;

        const contianer = document.createElement("div");
        contianer.id = "ia-toasts";
        const target = DOMManager.getElement("ia-body") || document.body || document.documentElement;
        if (!target) return;
        target.appendChild(contianer);

        const anyDOM: any = ReactDOM as any;
        const root = (typeof anyDOM?.createRoot === "function") ? anyDOM.createRoot(contianer) : null;
        Toasts.root = root;

        if (root && typeof root.render === "function") {
            root.render(React.createElement(ToastContianer));
        }
        else if (typeof anyDOM?.render === "function") {
            anyDOM.render(React.createElement(ToastContianer), contianer);
        }
    }
}
