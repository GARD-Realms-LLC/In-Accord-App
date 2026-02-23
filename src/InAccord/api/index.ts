import BDLogger from "@common/logger";

import PluginManager from "@modules/pluginmanager";
import ThemeManager from "@modules/thememanager";
import DiscordModules from "@modules/discordmodules";
import Config from "@stores/config";

import AddonAPI from "./addonapi";
import Data from "./data";
import DOM from "./dom";
import Patcher from "./patcher";
import ReactUtils from "./reactutils";
import UI from "./ui";
import Utils from "./utils";
import Webpack from "./webpack";
import ContextMenu from "./contextmenu";
import fetch from "./fetch";
import Logger from "./logger";
import CommandAPI from "./commands";
import Hooks from "./hooks";

import ColorInput from "@ui/settings/components/color";
import DropdownInput from "@ui/settings/components/dropdown";
import SettingItem from "@ui/settings/components/item";
import KeybindInput from "@ui/settings/components/keybind";
import NumberInput from "@ui/settings/components/number";
import RadioInput from "@ui/settings/components/radio";
import SearchInput from "@ui/settings/components/search";
import SliderInput from "@ui/settings/components/slider";
import SwitchInput from "@ui/settings/components/switch";
import TextInput from "@ui/settings/components/textbox";
import SettingGroup from "@ui/settings/group";
import ErrorBoundary from "@ui/errorboundary";
import Text from "@ui/base/text";
import Flex from "@ui/base/flex";
import Button from "@ui/base/button";
import Spinner from "@ui/spinner";

import type ReactType from "react";
import type ReactDOMBaseType from "react-dom";
import type ReactDOMClientType from "react-dom/client";
import ReactDOMImport from "@modules/reactdom";

type ReactDOMType = typeof ReactDOMBaseType & typeof ReactDOMClientType;


const bounded = new Map();
const PluginAPI = new AddonAPI(PluginManager);
const ThemeAPI = new AddonAPI(ThemeManager);
const PatcherAPI = new Patcher<false>();
const DataAPI = new Data<false>();
const DOMAPI = new DOM<false>();
const ContextMenuAPI = new ContextMenu();
const CommandsAPI = new CommandAPI<false>();
const HooksAPI = new Hooks();
const DefaultLogger = new Logger<false>();

/**
 * `Components` is a namespace holding a series of React components. It is available under {@link IaApi}.
 * @summary {@link Components} a namespace holding a series of React components
 * @name Components
 */
const Components = {
    get Tooltip() {return DiscordModules.Tooltip;},
    get ColorInput() {return ColorInput;},
    get DropdownInput() {return DropdownInput;},
    get SettingItem() {return SettingItem;},
    get KeybindInput() {return KeybindInput;},
    get NumberInput() {return NumberInput;},
    get RadioInput() {return RadioInput;},
    get SearchInput() {return SearchInput;},
    get SliderInput() {return SliderInput;},
    get SwitchInput() {return SwitchInput;},
    get TextInput() {return TextInput;},
    get SettingGroup() {return SettingGroup;},
    get ErrorBoundary() {return ErrorBoundary;},
    get Text() {return Text;},
    get Flex() {return Flex;},
    get Button() {return Button;},
    get Spinner() {return Spinner;},
};

/**
 * The React module being used inside Discord.
 * @type React
 * @memberof IaApi
 */
const React: typeof ReactType = DiscordModules.React;

/**
 * The ReactDOM module being used inside Discord.
 * @type ReactDOM
 * @memberof IaApi
 */
const ReactDOM: ReactDOMType = ReactDOMImport;

/**
 * A reference string for BD's version.
 * @type string
 * @memberof IaApi
 */
const version: string = Config.get("version");

/**
 * `IaApi` is a globally (`window.IaApi`) accessible object for use by plugins and developers to make their lives easier.
 * @name IaApi
 */
export default class IaApi {
    Patcher: Patcher<true> = PatcherAPI as Patcher<true>;
    Data: Data<true> = DataAPI as Data<true>;
    DOM: DOM<true> = DOMAPI as DOM<true>;
    Logger: Logger<true> = DefaultLogger as Logger<true>;
    Commands: CommandAPI<true> = CommandsAPI as unknown as CommandAPI<true>;
    React = React;
    ReactDOM = ReactDOM;
    version = version;

    static Patcher: Patcher<false>;
    static Data: Data<false>;
    static DOM: DOM<false>;
    static Logger: Logger<false>;
    static Commands: CommandAPI<false>;
    static Hooks: Hooks;
    static React = React;
    static ReactDOM = ReactDOM;
    static version = version;

    static Plugins: AddonAPI;
    static Themes: AddonAPI;
    static Webpack: typeof Webpack;
    static UI: typeof UI;
    static ReactUtils: typeof ReactUtils;
    static Utils: typeof Utils;
    static ContextMenu: ContextMenu;
    static Components: typeof Components;
    static Net: {fetch: typeof fetch;};

    constructor(pluginName: string) {
        if (!pluginName) return IaApi;
        if (bounded.has(pluginName)) return bounded.get(pluginName);
        if (typeof (pluginName) !== "string") {
            BDLogger.error("IaApi", "Plugin name not a string, returning generic API!");
            return IaApi;
        }

        // Bind to pluginName
        this.Patcher = new Patcher(pluginName);
        this.Data = new Data(pluginName);
        this.DOM = new DOM(pluginName);
        this.Logger = new Logger(pluginName);
        this.Commands = new CommandAPI(pluginName);
        this.Hooks = new Hooks(pluginName);

        bounded.set(pluginName, this);
    }

    // Non-bound namespaces
    get Plugins() {return PluginAPI;}
    get Themes() {return ThemeAPI;}
    get Webpack() {return Webpack;}
    get Utils() {return Utils;}
    get UI() {return UI;}
    get ReactUtils() {return ReactUtils;}
    get ContextMenu() {return ContextMenuAPI;}
    get Components() {return Components;}
    Net = {fetch};
}

/**
 * An instance of {@link AddonAPI} to access plugins.
 * @type AddonAPI
 */
IaApi.Plugins = PluginAPI;

/**
 * An instance of {@link AddonAPI} to access themes.
 * @type AddonAPI
 */
IaApi.Themes = ThemeAPI;

/**
 * An instance of {@link Patcher} to monkey patch functions.
 * @type Patcher
 */
IaApi.Patcher = PatcherAPI;

/**
 * An instance of {@link Webpack} to search for modules.
 * @type Webpack
 */
IaApi.Webpack = Webpack;

/**
 * An instance of {@link Data} to manage data.
 * @type Data
 */
IaApi.Data = DataAPI;

/**
 * An instance of {@link UI} to create interfaces.
 * @type UI
 */
IaApi.UI = UI;

/**
 * An instance of {@link ReactUtils} to work with React.
 * @type ReactUtils
 */
IaApi.ReactUtils = ReactUtils;

/**
 * An instance of {@link Utils} for general utility functions.
 * @type Utils
 */
IaApi.Utils = Utils;

/**
 * An instance of {@link DOM} to interact with the DOM.
 * @type DOM
 */
IaApi.DOM = DOMAPI;

/**
 * An instance of {@link ContextMenu} for interacting with context menus.
 * @type ContextMenu
 */
IaApi.ContextMenu = ContextMenuAPI;

/**
 * An set of react components plugins can make use of.
 * @type Components
 */
IaApi.Components = Components;

/**
 * An instance of {@link CommandAPI} for adding slash commands.
 * @type CommandAPI
 */
IaApi.Commands = CommandsAPI;

/**
 * An instance of {@link Net} for using network related tools.
 * @type Net
 */
IaApi.Net = {fetch};

/**
 * An instance of {@link Logger} for logging information.
 * @type Logger
 */
IaApi.Logger = DefaultLogger;

/**
 * An instance of {@link Hooks} for react hooks.
 * @type Hooks
 */
IaApi.Hooks = HooksAPI;

Object.freeze(IaApi);
Object.freeze(IaApi.Net);
Object.freeze(IaApi.prototype);
Object.freeze(IaApi.Components);
