import clsx from "clsx";
import React from "@modules/react";
import type {CSSProperties, ElementType, HTMLAttributes, PropsWithChildren} from "react";


export const Colors = Object.freeze({
    STANDARD: "ia-text-normal",
    MUTED: "ia-text-muted",
    ERROR: "ia-text-error",
    BRAND: "ia-text-brand",
    LINK: "ia-text-link",
    HEADER_PRIMARY: "ia-header-primary",
    HEADER_SECONDARY: "ia-header-secondary",
    STATUS_YELLOW: "ia-text-yellow",
    STATUS_GREEN: "ia-text-green",
    STATUS_RED: "ia-text-red",
    ALWAYS_WHITE: "ia-text-white",
    CUSTOM: null
});


export const Sizes = Object.freeze({
    SIZE_10: "ia-text-10",
    SIZE_12: "ia-text-12",
    SIZE_14: "ia-text-14",
    SIZE_16: "ia-text-16",
    SIZE_20: "ia-text-20",
    SIZE_24: "ia-text-24",
    SIZE_32: "ia-text-32"
});


type TextProps = PropsWithChildren<{
    tag?: ElementType<HTMLAttributes<HTMLElement>>;
    className?: string;
    color?: typeof Colors[keyof typeof Colors];
    size?: typeof Sizes[keyof typeof Sizes];
    selectable?: boolean;
    strong?: boolean;
    style?: CSSProperties;
    [other: string]: any;
}>;
export default function Text({tag: Tag = "div", className = "", children = null, color = Colors.STANDARD, size = Sizes.SIZE_14, selectable, strong, style, ...props}: TextProps) {
    return <Tag
        className={
            clsx(
                color, size, className,
                {
                    "ia-selectable": selectable,
                    "ia-text-strong": strong
                }
            )}
        style={style}
        {...props}
    >
        {children}
    </Tag>;
}

Text.Colors = Colors;
Text.Sizes = Sizes;

// te = WebpackModules.getModule(m => m?.Sizes?.SIZE_32 && m.Colors)
// foo = []
// for (const color in te.Colors) foo.push(iaApi.React.createElement(te, {color: te.Colors[color]}, color))
// for (const size in te.Sizes) foo.push(iaApi.React.createElement(te, {size: te.Sizes[size]}, size))
// iaApi.showConfirmationModal("Text Elements", foo)