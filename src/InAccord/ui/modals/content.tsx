import clsx from "clsx";
import React from "@modules/react";
import type {PropsWithChildren} from "react";


export default function Content({id, className, children, scroller = true}: PropsWithChildren<{id?: string; className?: string; scroller?: boolean}>) {
    return <div id={id} className={clsx("ia-modal-content", {"ia-scroller-base ia-scroller-thin": scroller}, className)}>
        {children}
    </div>;
}