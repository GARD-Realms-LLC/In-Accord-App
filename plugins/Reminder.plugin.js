/**
 * @name Reminder
 * @version 1.5.3
 * @description A BetterDiscord plugin that lets you create, view, and manage custom reminders and schedules with notification support.
 * @author DevEvil
 * @website https://devevil.com
 * @invite jsQ9UP7kCA
 * @authorId 468132563714703390
 * @donate https://devevil.com/dnt
 * @source https://github.com/DevEvil99/Reminder-BetterDiscord-Plugin
 * @updateUrl https://raw.githubusercontent.com/DevEvil99/Reminder-BetterDiscord-Plugin/main/Reminder.plugin.js
 */

const config = {
    info: {
        name: "Reminder",
        version: "1.5.3",
        description: "A BetterDiscord plugin that lets you create, view, and manage custom reminders and schedules with notification support.",
        authors: [{
            name: "DevEvil",
            discord_id: "468132563714703390",
            github_username: "DevEvil99"
        }],
        website: "https://devevil.com",
        github: "https://github.com/DevEvil99/Reminder-BetterDiscord-Plugin",
        github_raw: "https://raw.githubusercontent.com/DevEvil99/Reminder-BetterDiscord-Plugin/main/Reminder.plugin.js",
        invite: "jsQ9UP7kCA",
    }
};

const {
    Components,
    ContextMenu,
    Commands,
    Data,
    DOM,
    Logger,
    Net,
    Patcher,
    Plugins,
    ReactUtils,
    Themes,
    UI,
    Utils,
    Webpack,
    React
} = new BdApi();

class Reminder {
    constructor() {
        this.defaultSettings = {
            notificationSound: true,
            notificationSoundURL: "https://devevil99.github.io/devevil/files/Discord-Notification.mp3",
            reminderInterval: 60000,
            reminderShortcut: ["Shift", "R"],
            reminderInboxShortcut: ["Shift", "I"],
            scheduleManagerShortcut: ["Shift", "S"],
            buttonLocation: "both",
            firstDayOfWeek: "Sunday",
            repeatableReminderCount: 3,
            showReminderInboxIcon: true,
            showScheduleManagerButton: true,
            enableShortcuts: true,
            schedules: []
        };
        this.settings = this.loadSettings();
        this.reminders = this.loadReminders();
        this.acknowledgedReminders = {};
        this.checkInterval = null;
        this.audio = new Audio(this.settings.notificationSoundURL);
        this.reminderCount = 0;
        this.Days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    }

    loadSettings() {
        const saved = Data.load("Reminder", "settings") || {};
        return Object.assign({}, this.defaultSettings, saved);
    }

    saveSettings() {
        Data.save("Reminder", "settings", this.settings);
    }

    playNotificationSound() {
        if (this.settings.notificationSound) {
            try {
                this.audio.src = this.settings.notificationSoundURL || this.defaultSettings.notificationSoundURL;
                this.audio.play();
            } catch (e) {
                console.error("Error playing notification sound:", e);
            }
        }
    }

    loadReminders() {
        const data = Data.load("Reminder", "reminders");
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                console.error("Failed to parse reminders data:", e);
            }
        }
        return [];
    }

    saveReminders() {
        Data.save("Reminder", "reminders", JSON.stringify(this.reminders));
    }

    showModal(reminder) {
        this.playNotificationSound();
        this.reminderCount++;
        this.updateDiscordTitle();

        UI.showConfirmationModal(
            "Reminder",
            reminder.text, {
                confirmText: "OK",
                cancelText: null,
                onConfirm: () => {
                    this.reminderCount = 0;
                    this.updateDiscordTitle();
                    this.acknowledgedReminders[reminder.time] = true;

                    this.acknowledgedReminders[reminder.id] = true;

                    this.reminders = this.reminders.filter(r => r.id !== reminder.id);
                    this.saveReminders();
                }
            }
        );
    }

    start() {
        if (!Data.load("Reminder", "settings")) {
            this.saveSettings();
        }
    
        this.keybindHandler = (e) => {
            const checkKeybind = (keybind) => {
                if (!Array.isArray(keybind) || keybind.length === 0) return false;
                
                const keys = keybind.map(k => k.toLowerCase());
                
                const hasShift = keys.includes("shift");
                const hasCtrl = keys.includes("control") || keys.includes("ctrl");
                const hasAlt = keys.includes("alt");
                const hasMeta = keys.includes("meta") || keys.includes("cmd") || keys.includes("command");
                
                const mainKey = keys.find(k => !["shift", "control", "ctrl", "alt", "meta", "cmd", "command"].includes(k));
                if (!mainKey) return false;
                
                return (!hasShift || e.shiftKey) &&
                       (!hasCtrl || e.ctrlKey) &&
                       (!hasAlt || e.altKey) &&
                       (!hasMeta || e.metaKey) &&
                       e.key.toLowerCase() === mainKey;
            };

            if (checkKeybind(this.settings.reminderShortcut)) {
                e.preventDefault();
                this.openReminderModal();
            } else if (checkKeybind(this.settings.reminderInboxShortcut)) {
                e.preventDefault();
                this.showAllReminders();
            } else if (checkKeybind(this.settings.scheduleManagerShortcut)) {
                e.preventDefault();
                this.openScheduleManager();
            }
        };
    
        if (this.settings.enableShortcuts) {
            document.addEventListener("keydown", this.keybindHandler);
        }
    
        this.checkReminders();
        this.checkSchedules();
        if (["userarea", "both"].includes(this.settings.buttonLocation)) {
            this.addReminderButton();
        }
        if (["sidebar", "both"].includes(this.settings.buttonLocation)) {
            this.addReminderSidebar();
        }
        if (this.settings.showReminderInboxIcon) {
            this.addReminderInboxIcon();
        }
        this.checkInterval = setInterval(() => {
            this.checkReminders();
            this.checkSchedules();
        }, this.settings.reminderInterval);

        this.showChangelogIfNeeded();
    }

    stop() {
        Patcher.unpatchAll("Reminder");
        clearInterval(this.checkInterval);
        document.querySelector(".reminder-button")?.parentElement?.remove();
        document.querySelector(".reminderInboxIcon")?.remove();
        this.reminderCount = 0;
        this.updateDiscordTitle();
    
        document.removeEventListener("keydown", this.keybindHandler);
    
        if (this.guildsNavObserver) {
            this.guildsNavObserver.disconnect();
            this.guildsNavObserver = null;
            document.querySelector(".reminderPluginSideBtn")?.parentElement?.remove();
        }
    }
    
    addReminderButton() {
        if (!["userarea", "both"].includes(this.settings.buttonLocation)) return;

        const containerDiv = document.createElement("div");
        Object.assign(containerDiv.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "10px",
            gap: "10px"
        });

        const buttonContainer = document.createElement("div");
        Object.assign(buttonContainer.style, {
            display: "flex",
            gap: "10px",
            flex: 1
        });

        const button = document.createElement("button");
        button.textContent = "Add Reminder";
        Object.assign(button.style, {
            background: "var(--background-base-lowest)",
            outline: "none",
            border: "none",
            padding: "10px",
            borderRadius: "10px",
            flex: 1,
            color: "var(--text-default)",
            cursor: "pointer"
        });
        button.className = "reminder-button";
        button.onclick = () => this.openReminderModal();

        buttonContainer.appendChild(button);

        if (this.settings.showScheduleManagerButton) {
            const scheduleButton = document.createElement("button");
            Object.assign(scheduleButton.style, {
                background: "none",
                outline: "none",
                border: "none",
                padding: "10px",
                color: "var(--text-default)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            });
            scheduleButton.className = "schedule-manager-button";
            scheduleButton.onclick = () => this.openScheduleManager();
            scheduleButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 4h-1V3c0-.55-.45-1-1-1s-1 .45-1 1v1H8V3c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
                </svg>
            `;
            UI.createTooltip(scheduleButton, "Schedule Manager", { style: "primary", side: "top" });
            buttonContainer.appendChild(scheduleButton);
        }

        containerDiv.appendChild(buttonContainer);

        const panel = document.querySelector(`.${Webpack.getByKeys('panels').panels}`);
        if (panel) {
            panel.appendChild(containerDiv);
        }
    }

    addReminderSidebar() {
        if (this.guildsNavObserver) {
            this.guildsNavObserver.disconnect();
        }
    
        const observer = new MutationObserver(() => {
            const guildsNav = document.querySelector(`.${Webpack.getByKeys('unreadMentionsIndicatorBottom').itemsContainer}`);
            if (!guildsNav || guildsNav.querySelector('.reminderPluginSideBtn')) return;
    

            if (!["sidebar", "both"].includes(this.settings.buttonLocation)) return;
    
            const listItem = document.createElement("div");
            listItem.className = Webpack.getByKeys('tutorialContainer').listItem;
    
            const listItemWrapper = document.createElement("div");
            listItemWrapper.className = `${Webpack.getByKeys('listItemWrapper').listItemWrapper} reminderWrapper`;
    
            listItemWrapper.style.display = 'flex';
            listItemWrapper.style.justifyContent = 'center';
    
            const wrapper = document.createElement("div");
            wrapper.className = `${Webpack.getByKeys('lowerBadge').wrapper} reminderPluginSideBtn`;
    
            wrapper.innerHTML = `
            <svg width="48" height="48" viewBox="-4 -4 48 48" overflow="visible" style="cursor: pointer;">
                <defs>
                    <path d="M0 17.4545C0 11.3449 0 8.29005 1.18902 5.95647C2.23491 3.90379 3.90379 2.23491 5.95647 1.18902C8.29005 0 11.3449 0 17.4545 0H22.5455C28.6551 0 31.71 0 34.0435 1.18902C36.0962 2.23491 37.7651 3.90379 38.811 5.95647C40 8.29005 40 11.3449 40 17.4545V22.5455C40 28.6551 40 31.71 38.811 34.0435C37.7651 36.0962 36.0962 37.7651 34.0435 38.811C31.71 40 28.6551 40 22.5455 40H17.4545C11.3449 40 8.29005 40 5.95647 38.811C3.90379 37.7651 2.23491 36.0962 1.18902 34.0435C0 31.71 0 28.6551 0 22.5455V17.4545Z" id="reminder-blob-mask"></path>
                </defs>
                <mask id="reminder-mask" fill="black" x="0" y="0" width="40" height="40">
                    <use href="#reminder-blob-mask" fill="white" />
                </mask>
                <foreignObject mask="url(#reminder-mask)" x="0" y="0" width="40" height="40">
                    <div class="${Webpack.getByKeys('circleIcon').circleIconButton} reminderSideBtnIcon" aria-label="Reminders" role="treeitem" tabindex="-1">
                        <svg class="${Webpack.getByKeys('circleIcon').circleIcon}" aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg"
                            width="24" height="24" fill="none" viewBox="0 0 24 24">
                            <path fill="currentColor"
                                d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2Zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2Z" />
                        </svg>
                    </div>
                </foreignObject>
            </svg>
            `;
    
            wrapper.onclick = () => this.openReminderModal();
    
            listItem.appendChild(listItemWrapper);
            listItemWrapper.appendChild(wrapper);
            UI.createTooltip(wrapper, "Add Reminder", { style: "primary", side: "right" });
    
            const separator = guildsNav.querySelector('[aria-label="Servers"]');
            if (separator?.parentElement) {
                separator.parentElement.insertBefore(listItemWrapper, separator);
            } else {
                guildsNav.appendChild(listItemWrapper);
            }
        });
    
        observer.observe(document.body, { childList: true, subtree: true });
        this.guildsNavObserver = observer;
    }

    addReminderInboxIcon() {
        if (!this.settings.showReminderInboxIcon) return;

        const buttonClasses = `${Webpack.getByKeys('plateMuted').button} ${Webpack.getByKeys('plateMuted').enabled} ${Webpack.getByKeys('plateMuted').plated} ${Webpack.getByKeys('colorBrandInverted').button} ${Webpack.getByKeys('colorBrandInverted').lookBlank} ${Webpack.getByKeys('colorBrandInverted').colorBrand} ${Webpack.getByKeys('colorBrandInverted').grow} reminderInboxIcon`;
        const iconDivClasses = `${Webpack.getByKeys('lottieIcon').lottieIcon} ${Webpack.getByKeys('lottieIcon').lottieIconColors} ${Webpack.getByKeys('avatarWrapper').iconForeground}`;

        const button = document.createElement("button");
        button.className = buttonClasses;
        button.onclick = () => this.showAllReminders();

        const contentDiv = document.createElement("div");
        contentDiv.className = Webpack.getByKeys('colorBrandInverted').contents;

        const iconDiv = document.createElement("div");
        iconDiv.className = iconDivClasses;
        Object.assign(iconDiv.style, {
            '--__lottieIconColor': 'currentColor',
            display: 'flex',
            width: '20px',
            height: '20px'
        });
        

        const SVG_NS = "http://www.w3.org/2000/svg";

        const iconSvg = document.createElementNS(SVG_NS, 'svg');
        Object.assign(iconSvg.style, {
            width: '100%',
            height: '100%',
            contentVisibility: 'visible'
        });
        iconSvg.setAttribute('viewBox', '0 0 24 24');
        iconSvg.setAttribute('width', '24');
        iconSvg.setAttribute('height', '24');
        iconSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        iconSvg.setAttribute('xmlns', SVG_NS);
        iconSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
        

        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", "M5.024 3.783A1 1 0 0 1 6 3h12a1 1 0 0 1 .976.783L20.802 12h-4.244a1.99 1.99 0 0 0-1.824 1.205 2.978 2.978 0 0 1-5.468 0A1.991 1.991 0 0 0 7.442 12H3.198l1.826-8.217ZM3 14v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5h-4.43a4.978 4.978 0 0 1-9.14 0H3Z");
        path.setAttribute("fill", "currentColor");
        
        button.appendChild(contentDiv);
        contentDiv.appendChild(iconDiv);
        iconDiv.appendChild(iconSvg);
        iconSvg.appendChild(path);

        UI.createTooltip(button, "Reminder Inbox", { style: "primary", side: "top" });

        const buttonPanel = document.querySelector(`.${Webpack.getByKeys('avatarWrapper').buttons}`);
        if (buttonPanel) {
            buttonPanel.appendChild(button);
        }
    }
    

    refreshReminderButtons() {
        document.querySelector(".reminder-button")?.parentElement?.remove();
        document.querySelector(".reminderInboxIcon")?.remove();

        if (this.guildsNavObserver) {
            this.guildsNavObserver.disconnect();
            this.guildsNavObserver = null;
            document.querySelector(".reminderPluginSideBtn")?.parentElement?.remove();
        }

        if (["userarea", "both"].includes(this.settings.buttonLocation)) {
            this.addReminderButton();
        }
        if (["sidebar", "both"].includes(this.settings.buttonLocation)) {
            this.addReminderSidebar();
        }
        if (this.settings.showReminderInboxIcon) {
            this.addReminderInboxIcon();
        }
    }

    openHelpModal() {
        const { React } = BdApi;

        const HelpContent = () => {
            return React.createElement("div", null,
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "How to Add a Reminder"),
                React.createElement("ul", {
                        style: {
                            color: "var(--text-default)",
                            marginLeft: "20px",
                            listStyle: "circle"
                        }
                    },
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    }, "Enter a brief description in the 'Reminder Text' field."),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    }, "Set the time for your reminder using the 'Reminder Time' field by clicking on the clock icon."),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    }, "Click 'Add Reminder' to save the reminder."),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    }, "Your reminder will alert you at the specified time!")
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginTop: "30px",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "Schedule Manager"),
                React.createElement("p", {
                    style: {
                        color: "var(--text-default)",
                        marginBottom: "10px"
                    }
                }, "The Schedule Manager allows you to create recurring reminders with flexible scheduling options:"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-default)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Daily Schedules:"),
                        " Set reminders that repeat every X days at a specific time."
                    ),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Weekly Schedules:"),
                        " Create reminders that repeat every X weeks on specific days at a set time."
                    ),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Custom Intervals:"),
                        " Choose your preferred repeat interval (e.g., every 2 days or every 3 weeks)."
                    ),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Multiple Days:"),
                        " For weekly schedules, select multiple days for the reminder to trigger."
                    ),
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginTop: "30px",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "Other Features"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-default)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Reminder Day:"),
                        " Schedule reminders for a specific day of the week! Set the day you want, and your reminder will trigger at the selected time."
                    ),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Reminder Date:"),
                        " Schedule reminders for a specific date! Set the date you want, and your reminder will trigger at the selected time."
                    ),
                    React.createElement("li", {
                        style: {
                            marginBottom: "10px"
                        }
                    },
                        React.createElement("strong", null, "Repeatable Reminder:"),
                        ` Repeats reminders up to ${this.settings.repeatableReminderCount} times (set in settings, default 3) at 5-minute intervals unless acknowledged (by pressing 'OK').`
                    )
                )
            );
        };

        UI.showConfirmationModal(
            "Reminder Guide",
            React.createElement(HelpContent), {
                confirmText: "Close",
                cancelText: null
            }
        );
    }

    openScheduleManager() {
        const { React } = BdApi;

        const ScheduleForm = () => {
            const [scheduleName, setScheduleName] = React.useState("");
            const [triggerInterval, setTriggerInterval] = React.useState(1);
            const [triggerUnit, setTriggerUnit] = React.useState("week");
            const [selectedDays, setSelectedDays] = React.useState([]);
            const [reminderTime, setReminderTime] = React.useState("");

            const handleAddSchedule = () => {
                if (!scheduleName || !reminderTime || (triggerUnit !== "day" && selectedDays.length === 0)) {
                    UI.showToast("Please fill in all required fields!", { type: "error" });
                    return;
                }

                const newSchedule = {
                    id: Date.now(),
                    name: scheduleName,
                    interval: triggerInterval,
                    unit: triggerUnit,
                    days: triggerUnit === "day" ? this.Days : selectedDays.sort((a, b) => this.Days.indexOf(a) - this.Days.indexOf(b)),
                    time: reminderTime,
                    lastTriggered: null
                };

                const updatedSchedules = [...(this.settings.schedules || []), newSchedule];
                this.settings.schedules = updatedSchedules;
                this.saveSettings();
                this.setupScheduleReminders(newSchedule);

                setScheduleName("");
                setTriggerInterval(1);
                setTriggerUnit("week");
                setSelectedDays([]);
                setReminderTime("");

                UI.showToast("Schedule added successfully!", { type: "success" });
            };

            const baseDays = this.Days;
            const firstDay = this.settings.firstDayOfWeek || "Sunday";
            const firstDayIndex = baseDays.indexOf(firstDay);
            const daysOfWeek = [
                ...baseDays.slice(firstDayIndex),
                ...baseDays.slice(0, firstDayIndex)
            ];

            const toggleDay = (day) => {
                if (selectedDays.includes(day)) {
                    setSelectedDays(selectedDays.filter(d => d !== day));
                } else {
                    setSelectedDays([...selectedDays, day]);
                }
            };

            return React.createElement("div", {
            },
                React.createElement("div", {
                    style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "15px"
                    }
                },
                    React.createElement("h3", {
                        style: {
                            color: "var(--header-primary)"
                        }
                    }, "Add New Schedule"),
                    React.createElement("input", {
                        type: "text",
                        placeholder: "Schedule Text",
                        value: scheduleName,
                        onChange: (e) => setScheduleName(e.target.value),
                        style: {
                            padding: "10px",
                            borderRadius: "5px",
                            border: "none",
                            backgroundColor: "var(--background-base-lowest)",
                            color: "var(--header-primary)"
                        }
                    }),
                    React.createElement("div", {
                        style: {
                            display: "flex",
                            gap: "10px",
                            alignItems: "center"
                        }
                    },
                        React.createElement("span", {
                            style: { color: "var(--text-default)" }
                        }, "Every"),
                        React.createElement("input", {
                            type: "number",
                            min: "1",
                            value: triggerInterval,
                            onChange: (e) => setTriggerInterval(parseInt(e.target.value)),
                            style: {
                                width: "60px",
                                padding: "8px",
                                borderRadius: "5px",
                                border: "none",
                                backgroundColor: "var(--background-base-lowest)",
                                color: "var(--text-default)"
                            }
                        }),
                        React.createElement("select", {
                            value: triggerUnit,
                            onChange: (e) => setTriggerUnit(e.target.value),
                            style: {
                                padding: "8px",
                                borderRadius: "5px",
                                border: "none",
                                backgroundColor: "var(--background-base-lowest)",
                                color: "var(--text-default)"
                            }
                        },
                            React.createElement("option", { value: "day" }, "Day(s)"),
                            React.createElement("option", { value: "week" }, "Week(s)")
                        )
                    ),
                    triggerUnit !== "day" && React.createElement("div", {
                        style: {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "8px"
                        }
                    },
                        daysOfWeek.map(day => (
                            React.createElement("button", {
                                key: day,
                                onClick: () => toggleDay(day),
                                style: {
                                    padding: "8px 12px",
                                    borderRadius: "5px",
                                    border: "1px solid var(--border-subtle)",
                                    backgroundColor: selectedDays.includes(day) ? "var(--border-subtle)" : "var(--background-base-lowest)",
                                    color: "var(--text-default)",
                                    cursor: "pointer"
                                }
                            }, day)
                        ))
                    ),
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginTop: "8px"
                        }
                    }, "Schedule Time"),
                    React.createElement("input", {
                        type: "time",
                        value: reminderTime,
                        onChange: (e) => setReminderTime(e.target.value),
                        style: {
                            padding: "10px",
                            borderRadius: "5px",
                            border: "none",
                            backgroundColor: "var(--background-base-lowest)",
                            color: "var(--text-default)"
                        }
                    }),
                    React.createElement("button", {
                        onClick: handleAddSchedule,
                        style: {
                            marginTop: "8px",
                            padding: "10px",
                            borderRadius: "5px",
                            border: "none",
                            backgroundColor: "var(--button-filled-brand-background)",
                            color: "var(--white)",
                            cursor: "pointer"
                        }
                    }, "Add Schedule")
                )
            );
        };

        UI.showConfirmationModal(
            "Schedule Manager",
            React.createElement(ScheduleForm),
            {
                confirmText: "Close",
                cancelText: null
            }
        );
    }

    setupScheduleReminders(schedule) {
        const [hours, minutes] = schedule.time.split(":");
        let targetDate = new Date();
        targetDate.setHours(parseInt(hours));
        targetDate.setMinutes(parseInt(minutes));
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);

        this.reminders = this.reminders.filter(r => !(r.schedule && r.schedule.id === schedule.id));

        if (schedule.unit === "day") {
            if (targetDate.getTime() <= Date.now()) {
                targetDate.setDate(targetDate.getDate() + schedule.interval);
            }
            
            this.addReminder(
                schedule.name,
                targetDate,
                false,
                [],
                null,
                schedule
            );
        } else if (schedule.unit === "week") {
            schedule.days.forEach(day => {
                const dayIndex = this.Days.indexOf(day);
                const currentDayIndex = targetDate.getDay();
                let daysUntil = (dayIndex - currentDayIndex + 7) % 7;
                
                if (daysUntil === 0 && targetDate.getTime() <= Date.now()) {
                    daysUntil = 7 * schedule.interval;
                }

                const reminderDate = new Date(targetDate);
                reminderDate.setDate(reminderDate.getDate() + daysUntil);

                this.addReminder(
                    schedule.name,
                    reminderDate,
                    false,
                    [day],
                    null,
                    schedule
                );
            });
        }
        this.saveReminders();
    }

    checkSchedules() {
        if (!this.settings.schedules) return;
        
        this.settings.schedules.forEach(schedule => {
            const existingReminders = this.reminders.filter(r => r.schedule && r.schedule.id === schedule.id);
            
            if (existingReminders.length === 0) {
                this.setupScheduleReminders(schedule);
            }
        });
    }
    
    openReminderModal() {
        const { React } = BdApi;

        const selectedDayRef = { current: "" };
        const selectedDateRef = { current: "" };

        const ModalContent = () => {
            const [reminderText, setReminderText] = React.useState("");
            const [reminderTime, setReminderTime] = React.useState("");
            const [repeatable, setRepeatable] = React.useState(false);
            const [selectedDay, setSelectedDay] = React.useState("");
            const [selectedDate, setSelectedDate] = React.useState("");

            const selectDay = (day) => {
                if (selectedDay === day) {
                    setSelectedDay("");
                } else {
                    setSelectedDay(day);
                    setSelectedDate("");
                }
            };
            const selectDate = (date) => {
                setSelectedDate(date);
                if (date) setSelectedDay(""); 
            };

            React.useEffect(() => {
                selectedDayRef.current = selectedDay;
            }, [selectedDay]);
            React.useEffect(() => {
                selectedDateRef.current = selectedDate;
            }, [selectedDate]);

            const baseDays = this.Days;
            const firstDay = this.settings.firstDayOfWeek || "Sunday";
            const firstDayIndex = baseDays.indexOf(firstDay);
            const daysOfWeek = [
                ...baseDays.slice(firstDayIndex),
                ...baseDays.slice(0, firstDayIndex)
            ];

            return React.createElement("div", {
                    style: {
                        position: "relative"
                    }
                },
                React.createElement("svg", {
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        width: "24",
                        height: "24",
                        fill: "var(--__lottieIconColor,var(--interactive-normal))",
                        style: {
                            position: "absolute",
                            bottom: "0",
                            right: "0",
                            cursor: "pointer"
                        },
                        title: "How to Add a Reminder",
                        onClick: () => this.openHelpModal()
                    },
                    React.createElement("path", {
                        d: "M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.008-3.018a1.502 1.502 0 0 1 2.522 1.159v.024a1.44 1.44 0 0 1-1.493 1.418 1 1 0 0 0-1.037.999V14a1 1 0 1 0 2 0v-.539a3.44 3.44 0 0 0 2.529-3.256 3.502 3.502 0 0 0-7-.255 1 1 0 0 0 2 .076c.014-.398.187-.774.48-1.044Zm.982 7.026a1 1 0 1 0 0 2H12a1 1 0 1 0 0-2h-.01Z"
                    })),
                React.createElement("div", {
                        style: {
                            marginBottom: "15px"
                        }
                    },
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginBottom: "5px"
                        }
                    }, "Reminder Text"),
                    React.createElement("input", {
                        type: "text",
                        id: "reminderText",
                        placeholder: "Reminder text",
                        value: reminderText,
                        onChange: (e) => setReminderText(e.target.value),
                        required: true,
                        style: {
                            background: "var(--background-base-lowest)",
                            outline: "none",
                            border: "none",
                            padding: "10px",
                            borderRadius: "10px",
                            width: "95%",
                            color: "var(--header-primary)",
                        }
                    })
                ),
                React.createElement("div", {
                        style: {
                            marginBottom: "15px"
                        }
                    },
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginBottom: "5px"
                        }
                    }, "Reminder Time"),
                    React.createElement("input", {
                        type: "time",
                        id: "reminderTime",
                        value: reminderTime,
                        onChange: (e) => setReminderTime(e.target.value),
                        required: true,
                        style: {
                            background: "var(--background-base-lowest)",
                            outline: "none",
                            border: "none",
                            padding: "10px",
                            borderRadius: "10px",
                            width: "95%",
                            color: "var(--header-primary)",
                        }
                    })
                ),
                React.createElement("div", {
                        style: {
                            marginBottom: "15px"
                        }
                    },
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginBottom: "5px"
                        }
                    }, "Reminder Day (Optional)"),
                    React.createElement("div", {
                            style: {
                                display: "flex",
                                gap: "5px",
                                flexWrap: "wrap"
                            }
                        },
                        daysOfWeek.map(day =>
                            React.createElement("button", {
                                key: day,
                                onClick: () => selectDay(day),
                                disabled: !!selectedDate,
                                style: {
                                    padding: "5px 10px",
                                    borderRadius: "5px",
                                    border: "1px solid var(--border-subtle)",
                                    background: selectedDay === day ? "var(--border-subtle)" : "var(--background-base-lowest)",
                                    color: !!selectedDate ? "var(--text-muted)" : "var(--text-default)",
                                    cursor: !!selectedDate ? "not-allowed" : "pointer"
                                }
                            }, day.slice(0, 3))
                        )
                    )
                ),
                React.createElement("div", {
                        style: {
                            marginBottom: "15px"
                        }
                    },
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginBottom: "5px"
                        }
                    }, "Reminder Date (Optional)"),
                    React.createElement("input", {
                        type: "date",
                        id: "reminderDate",
                        value: selectedDate,
                        onChange: (e) => selectDate(e.target.value),
                        disabled: !!selectedDay,
                        style: {
                            background: "var(--background-base-lowest)",
                            outline: "none",
                            border: "none",
                            padding: "10px",
                            borderRadius: "10px",
                            width: "95%",
                            color: !!selectedDay ? "var(--text-muted)" : "var(--header-primary)",
                            cursor: !!selectedDay ? "not-allowed" : "pointer"
                        }
                    })
                ),
                React.createElement("div", {
                        style: {
                            marginBottom: "15px"
                        }
                    },
                    React.createElement("h4", {
                        style: {
                            color: "var(--header-primary)",
                            marginBottom: "5px"
                        }
                    }, "Repeatable Reminder"),
                    React.createElement("label", {
                            style: {
                                color: "var(--header-primary)",
                                fontSize: "12px",
                                display: "flex",
                                alignItems: "center",
                                cursor: "pointer",
                                position: "relative",
                                paddingLeft: "30px",
                                userSelect: "none"
                            }
                        },
                        React.createElement("input", {
                            type: "checkbox",
                            id: "repeatable",
                            checked: repeatable,
                            onChange: () => setRepeatable(!repeatable),
                            style: {
                                opacity: 0,
                                position: "absolute",
                                left: "0",
                                top: "0",
                                height: "20px",
                                width: "20px",
                                cursor: "pointer"
                            }
                        }),
                        React.createElement("span", {
                            style: {
                                position: "absolute",
                                left: "0",
                                top: "0",
                                height: "20px",
                                width: "20px",
                                backgroundColor: "var(--background-base-lowest)",
                                borderRadius: "5px",
                                transition: "0.2s ease-in-out",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                boxShadow: "0 2px 5px rgba(0, 0, 0, 0.5)",
                            }
                        }, repeatable && React.createElement("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            height: "16",
                            width: "16",
                            fill: "var(--interactive-active)",
                            viewBox: "0 0 24 24"
                        }, React.createElement("path", {
                            d: "M20.285 6.709a1 1 0 0 0-1.414-1.414l-9.928 9.929-3.535-3.535a1 1 0 1 0-1.414 1.414l4.243 4.243a1 1 0 0 0 1.414 0l10.634-10.637Z"
                        }))),
                        `Repeat this reminder up to ${this.settings.repeatableReminderCount} times every 5 minutes unless acknowledged (Pressing 'OK').`
                    )
                ),
                    React.createElement("div", {
                    style: {
                        display: "flex",
                        gap: "10px",
                        marginTop: "10px",
                        width: "80%"
                    }
                },
                    React.createElement(
                        "button",
                        {
                            style: {
                                background: "var(--background-base-lowest)",
                                border: "none",
                                padding: "10px",
                                borderRadius: "10px",
                                color: "var(--text-default)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flex: 1
                            },
                            onClick: () => this.showAllReminders()
                        },
                        React.createElement(
                            "svg",
                            {
                                xmlns: "http://www.w3.org/2000/svg",
                                width: "16",
                                height: "16",
                                fill: "currentColor",
                                viewBox: "0 0 16 16"
                            },
                            React.createElement("path", {
                                d: "M8 3.5a.5.5 0 0 1 .5.5v4h3a.5.5 0 0 1 0 1H8a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"
                            }),
                            React.createElement("path", {
                                d: "M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm0-1A7 7 0 1 1 8 1a7 7 0 0 1 0 14z"
                            })
                        ),
                        "Reminder Inbox"
                    ),
                    React.createElement(
                        "button",
                        {
                            style: {
                                background: "var(--background-base-lowest)",
                                border: "none",
                                padding: "10px",
                                borderRadius: "10px",
                                color: "var(--text-default)",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                flex: 1
                            },
                            onClick: () => this.openScheduleManager()
                        },
                        React.createElement(
                            "svg",
                            {
                                xmlns: "http://www.w3.org/2000/svg",
                                width: "16",
                                height: "16",
                                fill: "currentColor",
                                viewBox: "0 0 24 24"
                            },
                            React.createElement("path", {
                                d: "M19 4h-1V3c0-.55-.45-1-1-1s-1 .45-1 1v1H8V3c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"
                            })
                        ),
                        "Schedule Manager"
                    )
                )
            );
        };

        UI.showConfirmationModal(
            "Add Reminder",
            React.createElement(ModalContent),
            {
                confirmText: "Add Reminder",
                onConfirm: () => {
                    const reminderText = document.getElementById("reminderText").value;
                    const reminderTime = document.getElementById("reminderTime").value;
                    const repeatable = document.getElementById("repeatable").checked;
                    const selectedDay = selectedDayRef.current;
                    const selectedDate = selectedDateRef.current;

                    if (reminderText && reminderTime) {
                        const [hours, minutes] = reminderTime.split(":");
                        let targetDate = new Date();
                        targetDate.setHours(parseInt(hours));
                        targetDate.setMinutes(parseInt(minutes));
                        targetDate.setSeconds(0);
                        targetDate.setMilliseconds(0);

                        if (selectedDate) {
                            const [year, month, day] = selectedDate.split("-");
                            targetDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
                            this.addReminder(reminderText, targetDate, repeatable, [], selectedDate);
                        } else if (selectedDay) {
                            const dayIndex = this.Days.indexOf(selectedDay);
                            const currentDayIndex = targetDate.getDay();
                            let daysUntil = (dayIndex - currentDayIndex + 7) % 7;
                            if (daysUntil === 0 && targetDate.getTime() <= Date.now()) {
                                daysUntil = 7;
                            }
                            targetDate.setDate(targetDate.getDate() + daysUntil);
                            this.addReminder(reminderText, targetDate, repeatable, [selectedDay], null);
                        } else if (targetDate.getTime() <= Date.now()) {
                            targetDate.setDate(targetDate.getDate() + 1);
                            this.addReminder(reminderText, targetDate, repeatable, [], null);
                        } else {
                            this.addReminder(reminderText, targetDate, repeatable, [], null);
                        }
                        UI.showToast("Your reminder has been set and will alert you at the specified time.", {
                            type: "success"
                        });
                    } else {
                        UI.showToast("Please fill out Reminder Text & Reminder Time fields before adding a reminder.", {
                            type: "error"
                        });
                    }
                }
            }
        );
    }

    addReminder(text, time, repeatable, days = [], date = null, schedule = null) {
        const reminder = {
            id: Date.now() + Math.random(),
            text,
            time: typeof time === "number" ? time : time.getTime(),
            repeatable,
            repeatCount: 0,
            days,
            date,
            schedule
        };
        this.reminders.push(reminder);
        this.saveReminders();
    }
    

    deleteReminder(reminder) {
        if (reminder.schedule) {
            const scheduleReminders = this.reminders.filter(r => r.schedule && r.schedule.id === reminder.schedule.id);
            
            if (scheduleReminders.length === 1) {
                this.settings.schedules = this.settings.schedules.filter(s => s.id !== reminder.schedule.id);
                this.saveSettings();
            }
        
            this.reminders = this.reminders.filter(r => r.id !== reminder.id);
        } else {
            this.reminders = this.reminders.filter(r => r.time !== reminder.time);
        }
        this.saveReminders();
        this.showAllReminders();
    }

    checkReminders() {
        const now = new Date();
        const updatedReminders = [];
    
        this.reminders.forEach(reminder => {
            const reminderDate = new Date(reminder.time);
            const today = now.toLocaleString('en-US', { weekday: 'long' });
            const todayDateStr = now.toISOString().slice(0, 10);
    
            const isDue = reminder.time <= now.getTime() &&
                          now.getTime() - reminder.time <= this.settings.reminderInterval;
    
            let isMatch = false;
            if (reminder.date) {
                isMatch = reminder.date === todayDateStr;
            } else if (reminder.days && reminder.days.length > 0) {
                isMatch = reminder.days.includes(today);
            } else {
                isMatch = true;
            }
    
            if (isDue && isMatch && !this.acknowledgedReminders[reminder.id]) {
                this.showModal(reminder);
    
                if (reminder.repeatable && reminder.repeatCount < this.settings.repeatableReminderCount) {
                    reminder.repeatCount += 1;
                    reminder.time = now.getTime() + 5 * 60 * 1000;
                    delete this.acknowledgedReminders[reminder.id];
                    updatedReminders.push(reminder);
                } else {
                    if (reminder.schedule) {
                        const schedule = reminder.schedule;
                        let nextDate = new Date(reminder.time);
                        
                        if (schedule.unit === "day") {
                            nextDate.setDate(nextDate.getDate() + schedule.interval);
                        } else if (schedule.unit === "week") {
                            nextDate.setDate(nextDate.getDate() + (7 * schedule.interval));
                        }
                        
                        const newReminder = {
                            id: Date.now() + Math.random(),
                            text: reminder.text,
                            time: nextDate.getTime(),
                            repeatable: false,
                            repeatCount: 0,
                            days: reminder.days,
                            date: null,
                            schedule: schedule
                        };
                        updatedReminders.push(newReminder);
                    }
                    
                    this.acknowledgedReminders[reminder.id] = true;
                }
            } else {
                if (!reminder.date && reminder.days && reminder.days.length > 0 && reminder.time < now.getTime()) {
                    let nextDate = new Date();
                    const dayIndex = this.Days.indexOf(reminder.days[0]);
                    const currentDayIndex = nextDate.getDay();
                    let daysUntil = (dayIndex - currentDayIndex + 7) % 7;
                    if (daysUntil === 0) daysUntil = 7;
    
                    nextDate.setDate(nextDate.getDate() + daysUntil);
                    nextDate.setHours(reminderDate.getHours());
                    nextDate.setMinutes(reminderDate.getMinutes());
                    nextDate.setSeconds(0);
                    nextDate.setMilliseconds(0);
    
                    reminder.time = nextDate.getTime();
                    reminder.repeatCount = 0;
                }
    
                if (!this.acknowledgedReminders[reminder.id]) {
                    updatedReminders.push(reminder);
                }
            }
        });
    
        this.reminders = updatedReminders;
        this.saveReminders();
    }
    
    
    showAllReminders() {
        const { React } = BdApi;
    
        const ReminderList = () => {
            const [sortOrder, setSortOrder] = React.useState('asc');
    
            const sortedReminders = [...this.reminders].sort((a, b) => 
                sortOrder === 'asc' ? a.time - b.time : b.time - a.time
            );
    
            const handleSortToggle = () => {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            };
    
            const handleDelete = (reminder) => {
                UI.showConfirmationModal(
                    "Confirm Deletion",
                    `Are you sure you want to delete "${reminder.text}"?`,
                    {
                        confirmText: "Delete",
                        cancelText: "Cancel",
                        danger: true,
                        onConfirm: () => {
                            this.deleteReminder(reminder);
                            UI.showToast("Reminder deleted.", { type: "success" });
                        }
                    }
                );
            };
    
            return React.createElement("div", {
                style: {
                    padding: "20px",
                    maxHeight: "500px",
                    overflowY: "auto",
                    backgroundColor: "var(--background-base-lowest)",
                    borderRadius: "8px"
                }
            },
                React.createElement("div", {
                    style: {
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "20px"
                    }
                },
                    React.createElement("button", {
                        onClick: handleSortToggle,
                        style: {
                            background: "var(--autocomplete-bg)",
                            border: "none",
                            padding: "8px 12px",
                            borderRadius: "4px",
                            color: "var(--text-default)",
                            cursor: "pointer",
                            fontSize: "14px",
                            transition: "background-color 0.2s"
                        },
                        onMouseEnter: (e) => e.target.style.backgroundColor = "var(--button-secondary-background-hover)",
                        onMouseLeave: (e) => e.target.style.backgroundColor = "var(--button-secondary-background)"
                    },
                        React.createElement("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            width: "16",
                            height: "16",
                            fill: "currentColor",
                            viewBox: "0 0 24 24",
                            style: { marginRight: "5px", verticalAlign: "middle" }
                        }, 
                            React.createElement("path", {
                                d: "M5.05 3C3.291 3 2.352 5.024 3.51 6.317l5.422 6.059v4.874c0 .472.227.917.613 1.2l3.069 2.25c1.01.742 2.454.036 2.454-1.2v-7.124l5.422-6.059C21.647 5.024 20.708 3 18.95 3H5.05Z"
                            })
                        ),
                        `Sort by ${sortOrder === 'asc' ? 'Oldest' : 'Newest'}`
                    )
                ),
                this.reminders.length === 0 ?
                    React.createElement("div", {
                        style: {
                            textAlign: "center",
                            color: "var(--text-muted)",
                            padding: "20px",
                            border: "1px dashed var(--border-subtle)",
                            borderRadius: "8px"
                        }
                    },
                        React.createElement("svg", {
                            xmlns: "http://www.w3.org/2000/svg",
                            width: "48",
                            height: "48",
                            fill: "var(--text-muted)",
                            viewBox: "0 0 24 24",
                            style: { marginBottom: "10px" }
                        },
                            React.createElement("path", {
                                d: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
                            })
                        ),
                        React.createElement("p", {
                            style: {
                                fontSize: "16px",
                                margin: "10px 0"
                            }
                        }, "No reminders set.")
                    ) :
                    sortedReminders.map(reminder =>
                        React.createElement("div", {
                            key: reminder.time,
                            style: {
                                display: "grid",
                                gridTemplateColumns: "1fr auto auto",
                                alignItems: "center",
                                padding: "12px",
                                marginBottom: "10px",
                                backgroundColor: "var(--autocomplete-bg)",
                                borderRadius: "6px",
                                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                                transition: "transform 0.2s, opacity 0.2s",
                                opacity: "1",
                                transform: "scale(1)"
                            },
                            onMouseEnter: (e) => {
                                e.currentTarget.style.transform = "scale(1.02)";
                                e.currentTarget.style.opacity = "0.95";
                            },
                            onMouseLeave: (e) => {
                                e.currentTarget.style.transform = "scale(1)";
                                e.currentTarget.style.opacity = "1";
                            }
                        },
                            React.createElement("div", {
                                style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "4px"
                                }
                            },
                                React.createElement("div", {
                                    style: {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px"
                                    }
                                },
                                    React.createElement("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        width: "16",
                                        height: "16",
                                        fill: "var(--text-muted)",
                                        viewBox: "0 0 24 24"
                                    },
                                        React.createElement("path", {
                                            d: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Zm6.962 4.856a1.475 1.475 0 0 1 1.484.066A1 1 0 1 0 11.53 9.24a3.475 3.475 0 1 0-.187 5.955 1 1 0 1 0-.976-1.746 1.474 1.474 0 1 1-1.405-2.593Zm6.186 0a1.475 1.475 0 0 1 1.484.066 1 1 0 1 0 1.084-1.682 3.475 3.475 0 1 0-.187 5.955 1 1 0 1 0-.976-1.746 1.474 1.474 0 1 1-1.405-2.593Z"
                                        })
                                    ),
                                    React.createElement("span", {
                                        style: {
                                            color: "var(--text-default)",
                                            fontSize: "16px",
                                            fontWeight: "500"
                                        }
                                    }, reminder.schedule ? `[Schedule] ${reminder.text}` : reminder.text)
                                ),
                                React.createElement("div", {
                                    style: {
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        color: "var(--text-muted)",
                                        fontSize: "12px"
                                    }
                                },
                                    React.createElement("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        width: "14",
                                        height: "14",
                                        fill: "currentColor",
                                        viewBox: "0 0 24 24"
                                    },
                                        React.createElement("path", {
                                            d: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                                        })
                                    ),
                                    React.createElement("span", null,
                                        `${new Date(reminder.time).toLocaleString('en-US', {
                                            weekday: 'short',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}${reminder.days.length > 0 ? ` (${reminder.days[0]})` : ''}`
                                    ),
                                    reminder.repeatable &&
                                    React.createElement("span", {
                                        style: {
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "4px",
                                            background: "var(--border-subtle)",
                                            padding: "2px 6px",
                                            borderRadius: "4px"
                                        }
                                    },
                                        React.createElement("svg", {
                                            xmlns: "http://www.w3.org/2000/svg",
                                            width: "12",
                                            height: "12",
                                            fill: "var(--text-muted)",
                                            viewBox: "0 0 24 24"
                                        },
                                            React.createElement("path", {
                                                d: "M17.133 12.632v-1.8a5.406 5.406 0 0 0-4.154-5.262.955.955 0 0 0 .021-.106V3.1a1 1 0 0 0-2 0v2.364a.955.955 0 0 0 .021.106 5.406 5.406 0 0 0-4.154 5.262v1.8C6.867 15.018 5 15.614 5 16.807 5 17.4 5 18 5.538 18h12.924C19 18 19 17.4 19 16.807c0-1.193-1.867-1.789-1.867-4.175ZM8.823 19a3.453 3.453 0 0 0 6.354 0H8.823Z"
                                            })
                                        ),
                                        `Repeats: ${(reminder.repeatCount ?? 1) - 1}/${this.settings.repeatableReminderCount}`
                                    )
                                )
                            ),
                            React.createElement("div", {
                                style: {
                                    display: "flex",
                                    gap: "8px"
                                }
                            },
                                React.createElement("button", {
                                    onClick: () => handleDelete(reminder),
                                    style: {
                                        background: "var(--button-danger-background)",
                                        border: "none",
                                        padding: "6px 12px",
                                        borderRadius: "4px",
                                        color: "var(--text-default)",
                                        cursor: "pointer",
                                        fontSize: "14px",
                                        transition: "background-color 0.2s"
                                    },
                                    onMouseEnter: (e) => e.target.style.backgroundColor = "var(--button-danger-background-hover)",
                                    onMouseLeave: (e) => e.target.style.backgroundColor = "var(--button-danger-background)"
                                },
                                    React.createElement("svg", {
                                        xmlns: "http://www.w3.org/2000/svg",
                                        width: "16",
                                        height: "16",
                                        fill: "currentColor",
                                        viewBox: "0 0 24 24",
                                        style: { verticalAlign: "middle" }
                                    },
                                        React.createElement("path", {
                                            d: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
                                        })
                                    ),
                                    " Delete"
                                )
                            )
                        )
                    )
            );
        };
    
        UI.showConfirmationModal(
            "Reminder Inbox",
            React.createElement(ReminderList),
            {
                confirmText: "Close",
                cancelText: null,
                onConfirm: () => {}
            }
        );
    }

    updateDiscordTitle() {
        if (this.reminderCount > 0) {
            document.title = `(${this.reminderCount}) Reminder(s)`;
        } else {
            document.title = "Discord";
        }
    }

    createReminderInbox() {
        return React.createElement("div", {
                className: "reminder-inbox"
            },
            React.createElement("h2", {}, "Reminders"),
            ...this.reminders.map(reminder =>
                React.createElement("div", {
                        style: {
                            color: "var(--text-default)"
                        }
                    },
                    reminder.text)
            )
        );
    }

    showChangelog() {
        const changes = [
            {
                title: "Version 1.5.3",
                type: "fixed",
                items: [
                    "⚙️ **Plugin Startup Issue:** Fixed a problem that prevented the plugin from starting.",
                    "🎨 **Color Display Fix:** Resolved an issue where UI colors were not appearing correctly."
                ]
            },
            {
                title: "Version 1.5.2",
                type: "fixed",
                items: [
                    "🎨 **Color Display Fix:** Resolved an issue where UI colors were not appearing correctly."
                ]
            },
            {
                title: "Version 1.5.1",
                type: "added",
                items: [
                    "⌨️ **Shortcut Option:** Added an option in \"Advanced Settings\" to enable or disable keyboard shortcuts. (Suggested by SomeLadOnTheNet & Vaelek on GitHub)"
                ]
            },
            {
                title: "Major Update - Version 1.5",
                type: "added",
                items: [
                    "✨ **Schedule Manager:** Schedule Manager allows you to create recurring reminders with flexible, customizable scheduling options. Learn more in the **Reminder Guide**. (Suggested on GitHub by a now deleted user)",
                    "✨ **Reminder Date:** You can now set reminders for a specific date using a calendar input. Only one of \"Reminder Day\" or \"Reminder Date\" can be selected at a time. (Suggested by TirOFlanc on GitHub)",
                    "🔘 **Schedule Manager Button:** Added a calendar icon next to the \"Add Reminder\" button to open the Schedule Manager modal. (Can be hidden in settings)",
                    "⌨️ **New Shortcuts:** Added two new shortcuts: Reminder Inbox (Shift+I) and Schedule Manager (Shift+S). (Customizable in settings)",
                    "🖱️ **Day Toggle:** Clicking an already selected day now toggles it off.",
                    "⚙️ **New Settings Options:** 1. \"Show Schedule Manager Button\" (UI Settings), 2. \"Reminder Inbox Shortcut\" (Advanced Settings), 3. \"Schedule Manager Shortcut\" (Advanced Settings)"
                ]
            }
        ];

        const options = {
            title: "Reminder Plugin",
            subtitle: "By DevEvil",
            changes: changes,
        };

        UI.showChangelogModal({
            title: options.title,
            subtitle: options.subtitle,
            changes: options.changes
        });
    }

    showChangelogIfNeeded() {
        const lastVersion = Data.load("Reminder", "lastVersion");
        if (lastVersion !== config.info.version) {
            this.showChangelog();
            Data.save("Reminder", "lastVersion", config.info.version);
        }
    }

    getSettingsPanel() {
        return UI.buildSettingsPanel({
            settings: [
                {
                    type: "category",
                    id: "notification_options",
                    name: "Notification Settings",
                    collapsible: true,
                    shown: true,
                    settings: [
                        {
                            type: "switch",
                            id: "notificationSound",
                            name: "Notification Sound",
                            note: "Enable or disable the notification sound.",
                            value: this.settings.notificationSound,
                            onChange: (value) => {
                                this.settings.notificationSound = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "text",
                            id: "notificationSoundURL",
                            name: "Notification Sound URL",
                            note: "MP3 URL for the notification sound. Example: https://www.myinstants.com/media/sounds/discord-notification.mp3",
                            value: this.settings.notificationSoundURL,
                            placeholder: "Enter custom MP3 URL",
                            onChange: (value) => {
                                this.settings.notificationSoundURL = value;
                                this.saveSettings();
                            }
                        }
                    ]
                },
                {
                    type: "category",
                    id: "ui_options",
                    name: "UI Settings",
                    collapsible: true,
                    shown: false,
                    settings: [
                        {
                            type: "switch",
                            id: "showReminderInboxIcon",
                            name: "Show Reminder Inbox Icon",
                            note: "Show or hide the Reminder Inbox icon in the user panel.",
                            value: this.settings.showReminderInboxIcon,
                            onChange: (value) => {
                                this.settings.showReminderInboxIcon = value;
                                this.saveSettings();
                                this.refreshReminderButtons();
                            }
                        },
                        {
                            type: "switch",
                            id: "showScheduleManagerButton",
                            name: "Show Schedule Manager Button",
                            note: "Show or hide the Schedule Manager button next to the Reminder button.",
                            value: this.settings.showScheduleManagerButton,
                            onChange: (value) => {
                                this.settings.showScheduleManagerButton = value;
                                this.saveSettings();
                                this.refreshReminderButtons();
                            }
                        },
                        {
                            type: "radio",
                            id: "buttonLocation",
                            name: "Reminder Button Location",
                            note: "Choose where the Reminder button should appear.",
                            options: [
                                { name: "User Area", value: "userarea" },
                                { name: "Sidebar", value: "sidebar" },
                                { name: "Both", value: "both" }
                            ],
                            value: this.settings.buttonLocation,
                            onChange: (value) => {
                                this.settings.buttonLocation = value;
                                this.saveSettings();
                                this.refreshReminderButtons();
                            }
                        },
                        {
                            type: "radio",
                            id: "firstDayOfWeek",
                            name: "First Day of Week",
                            note: "Choose which day starts the week.",
                            options: [
                                { name: "Saturday", value: "Saturday" },
                                { name: "Sunday", value: "Sunday" },
                                { name: "Monday", value: "Monday" }
                            ],
                            value: this.settings.firstDayOfWeek,
                            onChange: (value) => {
                                this.settings.firstDayOfWeek = value;
                                this.saveSettings();
                            }
                        }
                    ]
                },
                {
                    type: "category",
                    id: "advanced_options",
                    name: "Advanced Settings",
                    collapsible: true,
                    shown: false,
                    settings: [
                        {
                            type: "number",
                            id: "repeatableReminderCount",
                            name: "Repeatable Reminder Count",
                            note: "Set the number of times a repeatable reminder will show up at 5-minute intervals unless acknowledged (minimum: 3, maximum: 10).",
                            value: this.settings.repeatableReminderCount,
                            min: 3,
                            max: 10,
                            step: 1,
                            onChange: (value) => {
                                this.settings.repeatableReminderCount = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "switch",
                            id: "enableShortcuts",
                            name: "Enable Shortcuts",
                            note: "Enable or disable all keyboard shortcuts.",
                            value: this.settings.enableShortcuts,
                            onChange: (value) => {
                                this.settings.enableShortcuts = value;
                                this.saveSettings();
                                if (value) {
                                    document.addEventListener("keydown", this.keybindHandler);
                                } else {
                                    document.removeEventListener("keydown", this.keybindHandler);
                                }
                            }
                        },
                        {
                            type: "keybind",
                            id: "reminderShortcut",
                            name: "Reminder Shortcut",
                            note: "Set your preferred shortcut to open the reminder modal (e.g., Shift+R).",
                            value: this.settings.reminderShortcut,
                            onChange: (value) => {
                                this.settings.reminderShortcut = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "keybind",
                            id: "reminderInboxShortcut",
                            name: "Reminder Inbox Shortcut",
                            note: "Set your preferred shortcut to open the reminder inbox (e.g., Shift+I).",
                            value: this.settings.reminderInboxShortcut,
                            onChange: (value) => {
                                this.settings.reminderInboxShortcut = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "keybind",
                            id: "scheduleManagerShortcut",
                            name: "Schedule Manager Shortcut",
                            note: "Set your preferred shortcut to open the schedule manager (e.g., Shift+S).",
                            value: this.settings.scheduleManagerShortcut,
                            onChange: (value) => {
                                this.settings.scheduleManagerShortcut = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "number",
                            id: "reminderInterval",
                            name: "Reminder Check Interval (ms)",
                            note: "This setting controls how often (in milliseconds) the plugin checks for upcoming reminders. The default interval is 1 minute (60000 milliseconds). Shorter intervals provide more frequent checks but may use more system resources.",
                            value: this.settings.reminderInterval,
                            min: 10000,
                            max: 300000,
                            step: 5000,
                            onChange: (value) => {
                                this.settings.reminderInterval = value;
                                this.saveSettings();
                            }
                        }
                    ]
                }
            ],
            onChange: (category, id, name, value) => {
                UI.showToast(`Updated ${id}!`, {
                    type: "success"
                });
            }
        });
    }
}

module.exports = class extends Reminder {
    constructor() {
        super();
    }
};
