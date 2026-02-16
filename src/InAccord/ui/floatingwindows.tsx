import React from "@modules/react";
import ReactDOM from "@modules/reactdom";
import Events from "@modules/emitter";
import DOMManager from "@modules/dommanager";

import FloatingWindowContianer from "./floating/container";
import {getByDisplayName} from "@webpack";
import type {FloatingWindowProps} from "./floating/window";


const AppLayerProvider = getByDisplayName<any>("AppLayerProvider");

let hasInitialized = false;
export default class FloatingWindows {
    static initialize() {
        const contianer = <FloatingWindowContianer />;
        const wrapped = AppLayerProvider
            ? React.createElement(AppLayerProvider().props.layerContext.Provider, {value: [document.querySelector("#app-mount > .layerContianer-2v_Sit")]}, contianer)
            : contianer;
        const div = DOMManager.parseHTML(`<div id="floating-windows-layer">`) as HTMLDivElement;
        DOMManager.iaBody.append(div);
        const root = ReactDOM.createRoot(div);
        root.render(wrapped);
        hasInitialized = true;
    }

    static open(window: FloatingWindowProps) {
        if (!hasInitialized) this.initialize();
        return Events.emit("open-window", window);
    }
}