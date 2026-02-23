/**
 * @name Extended Typing Sounds
 * @author SLX
 * @authorLink https://github.com/Slluxx
 * @description Play different click sounds when you press a key. Supports multiple keyboard sounds
 * @version 1.0.3
 * @donate https://www.paypal.me/sllxx
 * @source https://github.com/Slluxx/BetterDiscord-Extended-Typing-Sounds/tree/main
 * @updateUrl https://raw.githubusercontent.com/Slluxx/BetterDiscord-Extended-Typing-Sounds/refs/heads/main/ExtendedTypingSounds.plugin.js
 */

const keyList = {
    'Escape': 1,
    'F1': 59,
    'F2': 60,
    'F3': 61,
    'F4': 62,
    'F5': 63,
    'F6': 64,
    'F7': 65,
    'F8': 66,
    'F9': 67,
    'F10': 68,
    'F11': 87,
    'F12': 88,
    'F13': 91,
    'F14': 92,
    'F15': 93,

    'Backquote': 41,
    'Digit1': 2,
    'Digit2': 3,
    'Digit3': 4,
    'Digit4': 5,
    'Digit5': 6,
    'Digit6': 7,
    'Digit7': 8,
    'Digit8': 9,
    'Digit9': 10,
    'Digit0': 11,
    'Minus': 12,
    'Equal': 13,
    'Backspace': 8,

    'KeyA': 30,
    'KeyB': 48,
    'KeyC': 46,
    'KeyD': 32,
    'KeyE': 18,
    'KeyF': 33,
    'KeyG': 34,
    'KeyH': 35,
    'KeyI': 23,
    'KeyJ': 36,
    'KeyK': 37,
    'KeyL': 38,
    'KeyM': 50,
    'KeyN': 49,
    'KeyO': 24,
    'KeyP': 25,
    'KeyQ': 16,
    'KeyR': 19,
    'KeyS': 31,
    'KeyT': 20,
    'KeyU': 22,
    'KeyV': 47,
    'KeyW': 17,
    'KeyX': 45,
    'KeyY': 21,
    'KeyZ': 44,

    'Tab': 15,
    'CapsLock': 58,
    'ShiftLeft': 42,
    'ControlLeft': 29,
    'MetaLeft': 3675,
    'AltLeft': 56,
    'Semicolon': 18,
    'BracketLeft': 19,
    'Quote': 20,
    ';': 39,
    "'": 40,
    'Enter': 28,
    'Comma': 51,
    'Period': 52,
    'Slash': 53,
    'Space': 57,
    'PrintScreen': 3639,
    'ScrollLock': 70,
    'Pause': 3653,
    'Insert': 3666,
    'Delete': 3667,
    'Home': 3655,
    'End': 3663,
    'PageUp': 3657,
    'PageDown': 3665,
    'ArrowUp': 57416,
    'ArrowLeft': 57419,
    'ArrowRight': 57421,
    'ArrowDown': 57424,
    'ShiftRight': 42,
    'ControlRight': 29,
    'AltRight': 56,

    'BracketRight': 19,
    'Backslash': 53,
    'IntlBackslash': 53
}

class Settings {
    constructor() {
        this.data = {}
        this.data["volume"] = 50
        this.data["selectedSound"] = "cherrymx-blue-abs"

        this.load();

        this.panel = [
            { type: "slider", id: "volume", name: "Volume", note: "Adjust the volume of the sounds", value: 30, min: 0, max: 100 },
            {
                type: "dropdown",
                id: "selectedSound",
                name: "Basic Dropdown",
                note: "Change the type of sound a click makes.",
                value: "cherrymx-blue-abs",
                options: [
                    { label: "CherryMX Black - ABS keycaps", value: "cherrymx-black-abs" },
                    { label: "CherryMX Black - PBT keycaps", value: "cherrymx-black-pbt" },
                    { label: "CherryMX Blue - ABS keycaps", value: "cherrymx-blue-abs" },
                    { label: "CherryMX Blue - PBT keycaps", value: "cherrymx-blue-pbt" },
                    { label: "CherryMX Brown - ABS keycaps", value: "cherrymx-brown-abs" },
                    { label: "CherryMX Brown - PBT keycaps", value: "cherrymx-brown-pbt" },
                    { label: "CherryMX Red - ABS keycaps", value: "cherrymx-red-abs" },
                    { label: "CherryMX Red - PBT keycaps", value: "cherrymx-red-pbt" },
                    { label: "EG Crystal Purple", value: "eg-crystal-purple" },
                    { label: "EG Oreo", value: "eg-oreo" },
                    { label: "Topre Purple Hybrid - PBT keycaps", value: "topre-purple-hybrid-pbt" },
                ]
            },
        ]
    }

    load() {
        this.data = { ...this.data, ...BdApi.Data.load("ExtendedTypingSounds", "settings") };
    }

    save() {
        BdApi.Data.save("ExtendedTypingSounds", "settings", this.data);
    }

    GetUpdatePanelData() {
        Object.keys(this.data).forEach(key => {
            let setting = this.panel.find((item) => item.id === key);
            if (setting) setting.value = this.data[key]
        })
        return this.panel;
    }
}

class AudioManager {
    constructor(volume, soundtype) {
        this.volume = volume
        this.soundtype = soundtype

        this.ready = false

        this.audio = new Audio('https://github.com/Slluxx/BetterDiscord-Extended-Typing-Sounds/raw/refs/heads/main/sounds/' + this.soundtype + '/sound.ogg');
        this.maxAudioInstances = 5;

        if (document.getElementById("ETS") != null) this.cleanup();
        let container = document.createElement("div")
        container.id = "ETS"

        for (let i = 0; i < this.maxAudioInstances; i++) {
            let audioClone = this.audio.cloneNode();
            audioClone.volume = this.volume;
            container.appendChild(audioClone)
        }
        document.body.appendChild(container)


        fetch('https://cdn.jsdelivr.net/gh/Slluxx/BetterDiscord-Extended-Typing-Sounds@main/sounds/' + this.soundtype + '/config.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                this.defines = data["defines"];
                this.ready = true;
                console.log("Audiomanager ready")
            })
            .catch(error => {
                console.error('Error:', error);
            });
    }

    cleanup() {
        let container = document.getElementById("ETS");
        if (container) container.remove();
    }

    getAvailableAudio() {
        const container = document.getElementById("ETS");
        if (!container) {
            console.error("Audio container not found");
            return null;
        }

        const audioElements = container.getElementsByTagName("audio");

        for (let i = 0; i < audioElements.length; i++) {
            const audio = audioElements[i];
            if (audio.paused || audio.ended) {
                return audio;
            }
        }

        return audioElements[0] || null;
    }

    async play(index) {
        let from = this.defines[index][0] / 1000
        let to = this.defines[index][1]
        const clonedAudio = this.getAvailableAudio();
        clonedAudio.currentTime = from
        await clonedAudio.play();
        setTimeout(function () {
            clonedAudio.pause();
        }, to);
    }
}

module.exports = class ExtendedTypingSounds {

    start() {
        this.settings = new Settings();
        this.audiomanager = new AudioManager(this.settings.data["volume"] / 100, this.settings.data["selectedSound"]);
        
        // Track which keys are currently pressed to prevent repeat sounds
        this.pressedKeys = new Set();
        
        this.boundHandleKeydown = this.handleKeydown.bind(this);
        this.boundHandleKeyup = this.handleKeyup.bind(this);
        this.boundHandleClick = this.handleClick.bind(this);
        
        document.addEventListener('keydown', this.boundHandleKeydown);
        document.addEventListener('keyup', this.boundHandleKeyup);
        document.addEventListener('click', this.boundHandleClick);
    }


    stop() {
        let searchbar = document.getElementsByClassName("DraftEditor-root");
        if (searchbar.length != 0) {
            searchbar[0].removeEventListener('keydown', this.boundHandleKeydown);
            searchbar[0].removeEventListener('keyup', this.boundHandleKeyup);
        }
        
        document.removeEventListener('keydown', this.boundHandleKeydown);
        document.removeEventListener('keyup', this.boundHandleKeyup);
        document.removeEventListener('click', this.boundHandleClick);

        this.audiomanager.cleanup();
        this.settings = null;
        this.audiomanager = null;
        this.pressedKeys = null;
    }

    getSettingsPanel() {
        return BdApi.UI.buildSettingsPanel({
            settings: this.settings.GetUpdatePanelData(),
            onChange: (category, id, value) => {
                this.settings.data[id] = value;

                if (this.saveTimer) {
                    clearTimeout(this.saveTimer);
                }

                this.saveTimer = setTimeout(() => {
                    this.settings.save()
                    this.stop()
                    this.start()
                }, 1000);
            },
        });
    }

    async handleKeydown(event) {
        const keyCode = event.code;
        const index = keyList[keyCode] || false;
        
        // Check if key exists in our keyList
        if (!index) {
            // console.log("Not found", keyCode)
            return;
        }

        // Check if this key is already pressed (held down)
        if (this.pressedKeys.has(keyCode)) {
            // Key is being held, don't play sound again
            return;
        }

        // Mark key as pressed
        this.pressedKeys.add(keyCode);

        // Check if audiomanager is ready
        if (this.audiomanager.ready == false) return;
        
        // Play the sound for the initial key press
        this.audiomanager.play(index);
    }

    async handleKeyup(event) {
        const keyCode = event.code;
        
        // Remove key from pressed keys set when released
        this.pressedKeys.delete(keyCode);
    }

    async handleClick(event) {
        // as per: https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener
        // this is fine as multiple eventhandlers are simply discarded.
        // The seachbar is not in the DOM when discord start up the first time and i dont want to check using any kind of loop.
        let searchbar = document.getElementsByClassName("DraftEditor-root")
        if (searchbar.length != 0) {
            searchbar[0].addEventListener('keydown', this.boundHandleKeydown);
            searchbar[0].addEventListener('keyup', this.boundHandleKeyup);
        }
    }
}