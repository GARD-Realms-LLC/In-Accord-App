import clsx from "clsx";
import React from "@modules/react";
import type {CSSProperties, MouseEventHandler, PropsWithChildren} from "react";


export const Direction = Object.freeze({
    VERTICAL: "ia-flex-vertical",
    HORIZONTAL: "ia-flex-horizontal",
    HORIZONTAL_REVERSE: "ia-flex-reverse"
});

export const Justify = Object.freeze({
    START: "ia-flex-justify-start",
    END: "ia-flex-justify-end",
    CENTER: "ia-flex-justify-center",
    BETWEEN: "ia-flex-justify-between",
    AROUND: "ia-flex-justify-around"
});

export const Align = Object.freeze({
    START: "ia-flex-align-start",
    END: "ia-flex-align-end",
    CENTER: "ia-flex-align-center",
    STRETCH: "ia-flex-align-stretch",
    BASELINE: "ia-flex-align-baseline"
});

export const Wrap = Object.freeze({
    NO_WRAP: "ia-flex-no-wrap",
    WRAP: "ia-flex-wrap",
    WRAP_REVERSE: "ia-flex-wrap-reverse"
});


export function Child(props: {className?: string;[x: string]: any;}) {
    if (!props.className) props.className = "";
    props.className = clsx(props.className, "ia-flex-child");
    return <Flex {...props} />;
}

type FlexProps = PropsWithChildren<{
    id?: string;
    className?: string;
    style?: CSSProperties;
    shrink?: number;
    grow?: number;
    basis?: "auto",
    justify?: typeof Justify[keyof typeof Justify];
    direction?: typeof Direction[keyof typeof Direction];
    align?: typeof Align[keyof typeof Align];
    wrap?: typeof Wrap[keyof typeof Wrap];
    onClick?: MouseEventHandler<HTMLDivElement>;
}>;

export default function Flex({
    children,
    className,
    style,
    shrink = 1,
    grow = 1,
    basis = "auto",
    direction = Direction.HORIZONTAL,
    align = Align.STRETCH,
    justify = Justify.START,
    wrap = Wrap.NO_WRAP,
    ...props
}: FlexProps) {
    return <div
        {...props}
        className={clsx(
            "ia-flex",
            direction,
            justify,
            align,
            wrap,
            className
        )}
        style={Object.assign({
            flexShrink: shrink,
            flexGrow: grow,
            flexBasis: basis
        }, style)}
    >
        {children}
    </div>;
}

Flex.Child = Child;
Flex.Direction = Direction;
Flex.Align = Align;
Flex.Justify = Justify;
Flex.Wrap = Wrap;