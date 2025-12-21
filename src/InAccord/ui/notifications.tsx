import React, {ReactDOM} from "@modules/react";
import Button, {type ButtonProps, Colors, Looks} from "@ui/base/button";
import Settings from "@stores/settings";
import Notifications from "@stores/notifications";
import Text from "@ui/base/text";
import {CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon} from "lucide-react";
import DOMManager from "@modules/dommanager";
import DiscordModules from "@modules/discordmodules";
import type {MouseEvent, ReactNode} from "react";
import {useStateFromStores} from "@ui/hooks.ts";
import Markdown from "@ui/base/markdown.tsx";
import ErrorBoundary from "@ui/errorboundary.tsx";

const spring = DiscordModules.ReactSpring;

// TODO: let arven fix this
export type NotificationType = "warning" | "error" | "info" | "success";

interface ButtonActions extends ButtonProps {
    label: string;
    dontClose?: boolean;
    dontCloseOnActionIfHoldingShiftKey?: boolean;
}

export interface Notification {
    id: string;
    title?: string;
    content?: string | ReactNode;
    type?: NotificationType;
    duration?: number;
    actions?: ButtonActions[];

    onClose?(): void;

    onClick?(): void;

    icon?: React.ComponentType<any>;
}

const Icon = ({type}: {type: NotificationType;}) => {
    switch (type) {
        case "warning":
            return <TriangleAlertIcon color="var(--status-warning)" size="18px" />;
        case "error":
            return <CircleAlertIcon color="var(--status-danger)" size="18px" />;
        case "info":
            return <InfoIcon color="#3B82F6" size="18px" />;
        case "success":
            return <CircleCheckIcon color="var(--status-positive)" size="18px" />;
        default:
            return null;
    }
};

class NotificationUI {
    static contianer: HTMLDivElement | null = null;

    constructor() {
        const contianerId = "ia-notifications-contianer";
        let contianer = document.getElementById(contianerId) as HTMLDivElement;
        if (!contianer) {
            contianer = document.createElement("div");
            contianer.id = contianerId;
            DOMManager.iaBody.appendChild(contianer);
        }
        NotificationUI.contianer = contianer;

        ReactDOM.createRoot(contianer).render(<PersistentNotificationContianer />);
    }

    show(notif: Notification) {
        // If there are many notifications of one ID. This will cause eccentric issues like notifications not closing.
        // Or duplicate notifications.

        let notificationData = Notifications.notifications.find(notification => notification.id === notif.id);

        if (!notificationData) {
            const kSelf = Symbol("kSelf");

            notificationData = {
                ...notif,
                [kSelf]: true
            };

            this.upsertNotification(notificationData!);
        }

        const kSelf = Reflect.ownKeys(notificationData!).at(-1);

        return {
            id: notificationData!.id,
            isVisible: () => {
                const currentNotifications = Notifications.notifications;
                return currentNotifications.findIndex(notification => notification[kSelf]) !== -1;
            },
            close: () => {
                const currentNotifications = Notifications.notifications;
                const notificationIndex = currentNotifications.findIndex(notification => notification[kSelf]);

                if (notificationIndex !== -1) {
                    this.hide(notificationData!.id);
                }
            }
        };
    }

    upsertNotification(notificationData: Notification) {
        Notifications.addNotification(notificationData);
    }

    hide(id: string) {
        const currentNotifications = Notifications.notifications;
        const notificationIndex = currentNotifications.findIndex((n: Notification) => n.id === id);

        if (notificationIndex !== -1) {
            Notifications.removeNotification(currentNotifications[notificationIndex].id);
        }
    }
}

const PersistentNotificationContianer = () => {
    const notifications = useStateFromStores<Notification[]>(Notifications, () => Notifications.notifications.concat(), [], true);
    const position: string = useStateFromStores(Settings, () => Settings.get("settings", "general", "notificationPosition"));

    return (
        <div
            id="ia-notifications-root"
            className={`ia-notification-${position}`}
        >
            {notifications.map((notification) => (
                <NotificationItem
                    key={notification.id}
                    notification={notification}
                />
            ))}
        </div>
    );
};

const NotificationUIInstance = new NotificationUI();

const NotificationItem = ({notification}: {notification: Notification;}) => {
    const {
        id,
        title = "",
        content = "",
        type = "info",
        duration = 5000,
        actions = [],
    } = notification;

    const [isPaused, setIsPaused] = React.useState(false);

    const progressProps = spring.useSpring({
        width: "0%",
        from: {width: "100%"},
        config: {duration},
        pause: isPaused,
        onChange: ({width}: {width: string;}) => {
            if (width === "0%") {
                handleClose();
            }
        },
    });

    const handleClose = () => {
        NotificationUIInstance.hide(id);
        notification.onClose?.();
    };

    return (
        <spring.animated.div
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={`ia-notification ia-notification-${type}`}
        >
            <div className={"ia-notification-content"}>
                <div className="ia-notification-header">
                    <div className="ia-notification-icon">
                        <div className="ia-notification-icon">
                            {notification.icon ? (
                                <ErrorBoundary>
                                    <notification.icon />
                                </ErrorBoundary>
                            ) : (
                                <Icon type={type} />
                            )}
                        </div>
                    </div>
                    {title && <div className="ia-notification-title">{title}</div>}
                </div>
                {content && (
                    <div className="ia-notification-body">
                        <div className="ia-notification-content-text">
                            {content && (
                                <div className="ia-notification-body">
                                    <div className="ia-notification-content-text">
                                        {typeof content === "string" ? (
                                            <Markdown>{content}</Markdown>
                                        ) : (
                                            <ErrorBoundary>{content}</ErrorBoundary>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {actions.length > 0 && (
                <div className="ia-notification-footer">
                    {actions.map((action, index) => {
                        const color = Colors[action?.color?.toUpperCase()] ? `ia-button-color-${action?.color}` : Button.Colors.PRIMARY;
                        const look = Looks[action?.look?.toUpperCase()] ? `ia-button-${action?.look}` : Button.Looks.FILLED;

                        return <Button
                            {...action}
                            key={index}
                            color={color}
                            look={look}
                            onClick={(e) => {
                                e.stopPropagation();
                                action.onClick?.(e);
                                if (!action.dontClose && !(action.dontCloseOnActionIfHoldingShiftKey && e.shiftKey)) {
                                    handleClose();
                                }
                            }}
                            className="ia-notification-action"
                        >
                            {action?.label}
                        </Button>;
                    })}
                </div>
            )}
            <Text
                onClick={(e: MouseEvent) => {
                    e.stopPropagation();
                    handleClose();
                }}
                className="ia-notification-close"
            >
                ✕
            </Text>
            <spring.animated.div
                className="ia-notification-progress"
                style={{
                    ...progressProps,
                    backgroundColor: {
                        success: "var(--status-positive)",
                        error: "var(--status-danger)",
                        warning: "var(--status-warning)",
                        info: "var(--ia-brand)"
                    }[type]
                }}
            />
        </spring.animated.div>
    );
};

export default NotificationUIInstance;
