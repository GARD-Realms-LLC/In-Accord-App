import clsx from "clsx";
import React from "@modules/react";
import type {KeyboardEventHandler, MouseEvent, MouseEventHandler, PropsWithChildren, RefObject} from "react";


// S.Looks = y;
// S.Colors = I;
// S.BorderColors = O;
// S.Hovers = T;
// S.Sizes = v;

const {useCallback} = React;

export const Looks = Object.freeze({
    FILLED: "ia-button-filled",
    OUTLINED: "ia-button-outlined",
    LINK: "ia-button-link",
    BLANK: "ia-button-blank"
});

export const Colors = Object.freeze({
    BRAND: "ia-button-color-brand",
    BLURPLE: "ia-button-color-blurple",
    RED: "ia-button-color-red",
    GREEN: "ia-button-color-green",
    YELLOW: "ia-button-color-yellow",
    PRIMARY: "ia-button-color-primary",
    LINK: "ia-button-color-link",
    WHITE: "ia-button-color-white",
    TRANSPARENT: "ia-button-color-transparent",
    CUSTOM: ""
});


export const Sizes = Object.freeze({
    NONE: "",
    TINY: "ia-button-tiny",
    SMALL: "ia-button-small",
    MEDIUM: "ia-button-medium",
    LARGE: "ia-button-large",
    ICON: "ia-button-icon"
});


export type ButtonProps = PropsWithChildren<{
    className?: string;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
    buttonRef?: RefObject<HTMLButtonElement | null>;
    disabled?: boolean;
    type?: "button" | "submit" | "reset";
    look?: typeof Looks[keyof typeof Looks];
    color?: typeof Colors[keyof typeof Colors];
    size?: typeof Sizes[keyof typeof Sizes];
    grow?: boolean;
}>;

export default function Button({
    className,
    children,
    onClick,
    onKeyDown,
    buttonRef,
    disabled = false,
    type = "button",
    look = Looks.FILLED,
    color = Colors.BRAND,
    size = Sizes.MEDIUM,
    grow = true,
    ...others
}: ButtonProps) {

    const handleClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onClick?.(event);
    }, [onClick]);

    return <button {...others} className={
        clsx(
            "ia-button",
            className,
            look,
            color,
            size,
            grow ? "ia-button-grow" : ""
        )}
        ref={buttonRef}
        type={type === "button" ? undefined : type}
        onClick={disabled ? () => {} : handleClick}
        onKeyDown={disabled ? () => {} : onKeyDown}
        disabled={disabled}
    >
        <div className="ia-button-content">{children}</div>
    </button>;
}

Button.Looks = Looks;
Button.Colors = Colors;
Button.Sizes = Sizes;
// window.iaButton = Button;
// (() => {
//     const buttons = [];
//     for (const look in window.iaButton.Looks) {
//         if (!window.iaButton.Looks[look] || look === "BLANK") continue;
//         for (const color in window.iaButton.Colors) {
//             if (!window.iaButton.Colors[color]) continue;
//             for (const size in window.iaButton.Sizes) {
//                 if (!window.iaButton.Sizes[size]) continue;
//                 buttons.push(window.iaApi.React.createElement(window.iaButton, {
//                     look: window.iaButton.Looks[look],
//                     color: window.iaButton.Colors[color],
//                     size: window.iaButton.Sizes[size]
//                 }, "Hello World!"));
//                 buttons.push(window.iaApi.React.createElement("br"));
//             }
//         }
//     }
//     window.iaApi.showConfirmationModal("Buttons", buttons);
// })();