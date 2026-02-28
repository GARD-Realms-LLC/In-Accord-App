"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/common/constants/ipcevents.ts
var RELAUNCH, GET_PATH, RUN_SCRIPT, NAVIGATE, OPEN_DEVTOOLS, CLOSE_DEVTOOLS, TOGGLE_DEVTOOLS, OPEN_WINDOW, INSPECT_ELEMENT, MINIMUM_SIZE, WINDOW_SIZE, DEVTOOLS_WARNING, OPEN_DIALOG, REGISTER_PRELOAD, GET_ACCENT_COLOR, OPEN_PATH, HANDLE_PROTOCOL, EDITOR_OPEN, EDITOR_SHOULD_SHOW_WARNING, EDITOR_SETTINGS_GET, EDITOR_SETTINGS_UPDATE, LAUNCH_DISCORD, INJECTOR_RESTORE;
var init_ipcevents = __esm({
  "src/common/constants/ipcevents.ts"() {
    "use strict";
    RELAUNCH = "ia-relaunch-app";
    GET_PATH = "ia-get-path";
    RUN_SCRIPT = "ia-run-script";
    NAVIGATE = "ia-did-navigate-in-page";
    OPEN_DEVTOOLS = "ia-open-devtools";
    CLOSE_DEVTOOLS = "ia-close-devtools";
    TOGGLE_DEVTOOLS = "ia-toggle-devtools";
    OPEN_WINDOW = "ia-open-window";
    INSPECT_ELEMENT = "ia-inspect-element";
    MINIMUM_SIZE = "ia-minimum-size";
    WINDOW_SIZE = "ia-window-size";
    DEVTOOLS_WARNING = "ia-remove-devtools-message";
    OPEN_DIALOG = "ia-open-dialog";
    REGISTER_PRELOAD = "ia-register-preload";
    GET_ACCENT_COLOR = "ia-get-accent-color";
    OPEN_PATH = "ia-open-path";
    HANDLE_PROTOCOL = "ia-handle-protocol";
    EDITOR_OPEN = "ia-editor-open";
    EDITOR_SHOULD_SHOW_WARNING = "ia-editor-show-warning";
    EDITOR_SETTINGS_GET = "ia-editor-settings-get";
    EDITOR_SETTINGS_UPDATE = "ia-editor-settings-update";
    LAUNCH_DISCORD = "ia-launch-discord";
    INJECTOR_RESTORE = "ia-injector-restore";
  }
});

// src/electron/main/modules/reactdevtools.ts
var import_fs, import_path2, import_electron3, REACT_DEVTOOLS_ID, findLatestVersion, findExtension, ReactDevTools;
var init_reactdevtools = __esm({
  "src/electron/main/modules/reactdevtools.ts"() {
    "use strict";
    import_fs = __toESM(require("fs"));
    import_path2 = __toESM(require("path"));
    import_electron3 = require("electron");
    REACT_DEVTOOLS_ID = "fmkadmapgofadopljbjfkapdkoienihi";
    findLatestVersion = (extensionPath) => {
      const versions = import_fs.default.readdirSync(extensionPath);
      return import_path2.default.resolve(extensionPath, versions[versions.length - 1]);
    };
    findExtension = (dataPath) => {
      const replacementPath = import_path2.default.resolve(dataPath, "extensions", REACT_DEVTOOLS_ID);
      if (import_fs.default.existsSync(replacementPath)) {
        if (import_fs.default.existsSync(import_path2.default.resolve(replacementPath, "manifest.json"))) {
          return replacementPath;
        }
        return findLatestVersion(replacementPath);
      }
      let extensionPath = "";
      if (process.platform === "win32") extensionPath = import_path2.default.resolve(process.env.LOCALAPPDATA, "Google/Chrome/User Data");
      else if (process.platform === "linux") extensionPath = import_path2.default.resolve(process.env.HOME, ".config/google-chrome");
      else if (process.platform === "darwin") extensionPath = import_path2.default.resolve(process.env.HOME, "Library/Application Support/Google/Chrome");
      else extensionPath = import_path2.default.resolve(process.env.HOME, ".config/chromium");
      if (!import_fs.default.existsSync(extensionPath + "/Default")) {
        const profiles = import_fs.default.readdirSync(extensionPath).filter((fileName) => {
          return fileName.startsWith("Profile") && !fileName.endsWith("store");
        });
        let foundExtension = false;
        for (const p of profiles) {
          const exPath = `${extensionPath}/${p}/Extensions/${REACT_DEVTOOLS_ID}`;
          if (import_fs.default.existsSync(exPath)) {
            extensionPath = exPath;
            foundExtension = true;
            break;
          }
        }
        if (!foundExtension) {
          return "";
        }
      } else {
        extensionPath += `/Default/Extensions/${REACT_DEVTOOLS_ID}`;
      }
      if (import_fs.default.existsSync(extensionPath)) {
        extensionPath = findLatestVersion(extensionPath);
      }
      const isExtensionInstalled = import_fs.default.existsSync(extensionPath);
      if (isExtensionInstalled) return extensionPath;
      return "";
    };
    ReactDevTools = class {
      static async install(dataPath) {
        const extPath = findExtension(dataPath);
        if (!extPath) return;
        try {
          const ext = await import_electron3.session.defaultSession.loadExtension(extPath);
          if (!ext) return;
        } catch {
        }
      }
      static async remove(dataPath) {
        const extPath = findExtension(dataPath);
        if (!extPath) return;
        try {
          await import_electron3.session.defaultSession.removeExtension(extPath);
        } catch {
        }
      }
    };
  }
});

// src/electron/main/modules/inaccord.ts
var inaccord_exports = {};
__export(inaccord_exports, {
  default: () => InAccord
});
function safeLog(message) {
  try {
    const logPath = import_path3.default.join(__dirname, "fatal_crash.log");
    try {
      import_fs2.default.appendFileSync(logPath, `
[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
    } catch {
    }
    try {
      const alt = import_path3.default.join(iaFolder || import_electron4.default.app.getPath("userData") + "/..", "InAccord", "fatal_crash.log");
      import_fs2.default.appendFileSync(alt, `
[${(/* @__PURE__ */ new Date()).toISOString()}] ${message}`);
    } catch {
    }
  } catch {
  }
}
var import_fs2, import_path3, import_electron4, import_child_process2, appPath, buildInfoFile, iaFolder, hasCrashed, injectionAttempts, InAccord;
var init_inaccord = __esm({
  "src/electron/main/modules/inaccord.ts"() {
    "use strict";
    import_fs2 = __toESM(require("fs"));
    import_path3 = __toESM(require("path"));
    import_electron4 = __toESM(require("electron"));
    import_child_process2 = require("child_process");
    init_reactdevtools();
    init_ipcevents();
    appPath = import_electron4.default.app.getAppPath();
    buildInfoFile = import_path3.default.resolve(appPath, "..", "build_info.json");
    iaFolder = "";
    if (process.platform === "win32" || process.platform === "darwin") iaFolder = import_path3.default.join(import_electron4.default.app.getPath("userData"), "..");
    else iaFolder = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : import_path3.default.join(process.env.HOME, ".config");
    iaFolder = import_path3.default.join(iaFolder, "InAccord") + "/";
    hasCrashed = false;
    injectionAttempts = /* @__PURE__ */ new WeakMap();
    InAccord = class _InAccord {
      static _settings;
      static getSetting(category, key) {
        if (this._settings) return this._settings[category]?.[key];
        try {
          const buildInfo = require(buildInfoFile);
          const settingsFile = import_path3.default.resolve(iaFolder, "data", buildInfo.releaseChannel, "settings.json");
          this._settings = require(settingsFile) ?? {};
          safeLog(`Loaded settings file for channel=${buildInfo.releaseChannel}: ${settingsFile}`);
          return this._settings[category]?.[key];
        } catch {
          this._settings = {};
          safeLog(`Failed to load settings for category=${category} key=${key}; falling back to defaults`);
          return this._settings[category]?.[key];
        }
      }
      static ensureDirectories() {
        const dataFolder = import_path3.default.join(iaFolder, "data");
        const backupFolder = import_path3.default.join(iaFolder, "backup");
        const backupsFolder = import_path3.default.join(iaFolder, "backups");
        if (!import_fs2.default.existsSync(iaFolder)) import_fs2.default.mkdirSync(iaFolder);
        if (!import_fs2.default.existsSync(dataFolder)) import_fs2.default.mkdirSync(dataFolder);
        if (!import_fs2.default.existsSync(import_path3.default.join(dataFolder, "stable"))) import_fs2.default.mkdirSync(import_path3.default.join(dataFolder, "stable"));
        if (!import_fs2.default.existsSync(import_path3.default.join(dataFolder, "canary"))) import_fs2.default.mkdirSync(import_path3.default.join(dataFolder, "canary"));
        if (!import_fs2.default.existsSync(import_path3.default.join(dataFolder, "ptb"))) import_fs2.default.mkdirSync(import_path3.default.join(dataFolder, "ptb"));
        if (!import_fs2.default.existsSync(import_path3.default.join(dataFolder, "development"))) import_fs2.default.mkdirSync(import_path3.default.join(dataFolder, "development"));
        if (!import_fs2.default.existsSync(backupFolder) && import_fs2.default.existsSync(backupsFolder)) import_fs2.default.mkdirSync(backupFolder);
        if (!import_fs2.default.existsSync(backupFolder)) import_fs2.default.mkdirSync(backupFolder);
        if (!import_fs2.default.existsSync(backupsFolder)) import_fs2.default.mkdirSync(backupsFolder);
        if (!import_fs2.default.existsSync(import_path3.default.join(iaFolder, "plugins"))) import_fs2.default.mkdirSync(import_path3.default.join(iaFolder, "plugins"));
        if (!import_fs2.default.existsSync(import_path3.default.join(iaFolder, "themes"))) import_fs2.default.mkdirSync(import_path3.default.join(iaFolder, "themes"));
      }
      static async injectRenderer(browserWindow) {
        const location = import_path3.default.join(__dirname, "InAccord.js");
        if (!import_fs2.default.existsSync(location)) {
          safeLog(`InAccord renderer bundle not found at ${location}`);
          return;
        }
        let content;
        try {
          content = import_fs2.default.readFileSync(location).toString();
        } catch (err) {
          safeLog(`Failed to read InAccord renderer bundle at ${location}: ${err && err.stack || err}`);
          return;
        }
        safeLog(`Injecting renderer bundle into window id=${browserWindow.id || "unknown"}`);
        try {
          const attempts = injectionAttempts.get(browserWindow) ?? 0;
          const ready = await browserWindow.webContents.executeJavaScript("typeof window !== 'undefined' && !!window.webpackChunkdiscord_app && typeof window.webpackChunkdiscord_app.push === 'function'", true).catch(() => false);
          const hasPreloadFn = await browserWindow.webContents.executeJavaScript("typeof window !== 'undefined' && typeof window.InAccordPreload === 'function'", true).catch(() => false);
          if (!ready || !hasPreloadFn) {
            if (!hasPreloadFn) safeLog("Renderer missing InAccordPreload function, will retry");
            if (!ready) {
              if (attempts < 10) {
                injectionAttempts.set(browserWindow, attempts + 1);
                safeLog(`Renderer not ready for injection (attempt ${attempts + 1}), scheduling retry`);
                setTimeout(() => this.injectRenderer(browserWindow), 1e3);
                return;
              }
              safeLog(`Renderer not ready after ${attempts} attempts, aborting inject`);
              return;
            }
            injectionAttempts.set(browserWindow, attempts + 1);
            if ((injectionAttempts.get(browserWindow) ?? 0) <= 10) {
              safeLog(`Preload function missing, retrying injection (attempt ${injectionAttempts.get(browserWindow)})`);
              setTimeout(() => this.injectRenderer(browserWindow), 500);
              return;
            }
            safeLog(`Preload function not available after retries, aborting inject`);
            return;
          }
        } catch (checkErr) {
          safeLog(`Error while checking renderer readiness: ${checkErr && checkErr.stack || checkErr}`);
        }
        try {
          const b64 = Buffer.from(content, "utf8").toString("base64");
          const wrapper = `
                (function(){
                    try {
                        const src = atob('${b64}');
                        (function(){ eval(src); }).call(window);
                        return { success: true };
                    } catch(error) {
                        try { console.error(error); } catch {}
                        return { success: false, message: (error && (error.message || String(error))) || 'unknown', stack: (error && error.stack) || null };
                    }
                })();
                //# sourceURL=InAccord/InAccord.js
            `;
          const result = await browserWindow.webContents.executeJavaScript(wrapper, true);
          if (!result || !result.success) {
            safeLog(`Injection of renderer bundle returned failure: ${result && (result.message || JSON.stringify(result))}`);
            if (result && result.stack) safeLog(`Injection stack: ${result.stack}`);
            return;
          }
        } catch (err) {
          safeLog(`Execution error while injecting renderer bundle: ${err && err.stack || err}`);
          return;
        }
      }
      static setup(browserWindow) {
        try {
          process.env.DISCORD_RELEASE_CHANNEL = require(buildInfoFile).releaseChannel;
          safeLog(`Detected release channel: ${process.env.DISCORD_RELEASE_CHANNEL}`);
        } catch {
          process.env.DISCORD_RELEASE_CHANNEL = "stable";
          safeLog(`build_info.json missing, defaulting release channel to stable`);
        }
        process.env.DISCORD_PRELOAD = browserWindow.__originalPreload;
        process.env.DISCORD_APP_PATH = appPath;
        process.env.DISCORD_USER_DATA = import_electron4.default.app.getPath("userData");
        process.env.InAccord_DATA_PATH = iaFolder;
        process.env.inaccord_BACKUP_FOLDER = "backup";
        process.env.inaccord_DATA_PATH = iaFolder;
        browserWindow.webContents.on("dom-ready", () => {
          if (!hasCrashed) return setTimeout(() => this.injectRenderer(browserWindow), 1e3);
          import_electron4.default.dialog.showMessageBox({
            title: "Discord Crashed",
            type: "warning",
            message: "Something crashed your Discord Client",
            detail: "InAccord has automatically disabled itself just in case. To enable it agian, restart Discord or click the button below.\n\nThis may have been caused by a plugin. Try moving all of your plugins outside the plugin folder and see if Discord still crashed.",
            buttons: ["Try Agian", "Open Plugins Folder", "Cancel"]
          }).then((result) => {
            if (result.response === 0) {
              import_electron4.default.app.relaunch();
              import_electron4.default.app.exit();
            }
            if (result.response === 1) {
              if (process.platform === "win32") (0, import_child_process2.spawn)("explorer.exe", [import_path3.default.join(iaFolder, "plugins")]);
              else import_electron4.default.shell.openPath(import_path3.default.join(iaFolder, "plugins"));
            }
          });
          hasCrashed = false;
        });
        browserWindow.webContents.on("did-navigate-in-page", () => {
          browserWindow.webContents.send(NAVIGATE);
        });
        browserWindow.webContents.on("render-process-gone", () => {
          hasCrashed = true;
          safeLog(`Renderer process gone for window (hasCrashed set).`);
        });
        if (import_electron4.default.app.setAsDefaultProtocolClient("InAccord")) {
          const protocol = process.argv.find((arg) => arg.startsWith("InAccord://"));
          if (protocol) {
            process.env.InAccord_PROTOCOL = protocol;
          }
          import_electron4.default.app.on("open-url", (_, url) => {
            if (url.startsWith("InAccord://")) {
              browserWindow.webContents.send(HANDLE_PROTOCOL, url);
            }
          });
          import_electron4.default.app.on("second-instance", (_, argv) => {
            if (argv.includes("--multi-instance")) return;
            const url = argv.find((arg) => arg.startsWith("InAccord://"));
            if (url) {
              browserWindow.webContents.send(HANDLE_PROTOCOL, url);
            }
          });
        }
      }
      static disableMediaKeys() {
        if (!_InAccord.getSetting("general", "mediaKeys")) return;
        const originalDisable = import_electron4.default.app.commandLine.getSwitchValue("disable-features") || "";
        import_electron4.default.app.commandLine.appendSwitch("disable-features", `${originalDisable ? "," : ""}HardwareMediaKeyHandling,MediaSessionService`);
      }
    };
    if (InAccord.getSetting("developer", "reactDevTools")) {
      import_electron4.default.app.whenReady().then(async () => {
        await ReactDevTools.install(iaFolder);
      });
    }
    Object.defineProperty(global, "appSettings", {
      set(setting) {
        setting.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
        if (InAccord.getSetting("window", "removeMinimumSize")) {
          setting.set("MIN_WIDTH", 0);
          setting.set("MIN_HEIGHT", 0);
        } else {
          setting.set("MIN_WIDTH", 940);
          setting.set("MIN_HEIGHT", 500);
        }
        delete global.appSettings;
        global.appSettings = setting;
      },
      configurable: true,
      enumerable: false
    });
  }
});

// src/electron/main/index.ts
var import_electron7 = require("electron");
var import_path5 = __toESM(require("path"));
var import_fs3 = __toESM(require("fs"));

// src/electron/main/modules/ipc.ts
var import_child_process = require("child_process");
var import_electron2 = require("electron");
init_ipcevents();

// src/electron/main/modules/editor.ts
var import_electron = require("electron");
var import_path = __toESM(require("path"));
var import_url = require("url");
init_ipcevents();
var Editor = class {
  static windows = { backup: {}, theme: {}, plugin: {} };
  // For eventually allow ia to have intellisense in the external window
  static _options;
  static open(type, filename) {
    const openedViaWindow = !!this._options;
    let window = type === "custom-css" ? this.windows["custom-css"] : this.windows[type][filename];
    if (openedViaWindow && window) {
      if (!window.webContents.isLoading()) {
        window.show();
      }
      return this._options.webContents;
    }
    if (typeof window === "undefined" || window.isDestroyed()) {
      window = new import_electron.BrowserWindow({
        ...this._options,
        frame: true,
        center: true,
        show: false,
        webPreferences: {
          ...this._options?.webPreferences,
          preload: import_path.default.join(__dirname, "editor/preload.js"),
          sandbox: false,
          allowRunningInsecureContent: true,
          webSecurity: false
        }
      });
      this._options = null;
      window.setMenu(null);
      const url = (0, import_url.pathToFileURL)(import_path.default.join(__dirname, "editor/index.html"));
      url.searchParams.set("type", type);
      url.searchParams.set("filename", filename || "custom.css");
      if (openedViaWindow) {
        window.webContents.once("will-navigate", (e) => {
          e.preventDefault();
          window.loadURL(url.href);
          window.once("ready-to-show", () => {
            window.show();
          });
        });
      } else {
        window.once("ready-to-show", () => {
          window.show();
        });
        window.loadURL(url.href);
      }
      let shouldWarn = false;
      window.webContents.ipc.handle(EDITOR_SHOULD_SHOW_WARNING, (_, $shouldWarn) => {
        shouldWarn = $shouldWarn;
      });
      window.on("close", (event) => {
        if (!shouldWarn) return;
        event.preventDefault();
        const result = import_electron.dialog.showMessageBoxSync(window, {
          type: "question",
          title: "Close Editor?",
          message: "Changes you made are not saved",
          buttons: ["Quit", "Quit"],
          cancelId: 1,
          defaultId: 1,
          normalizeAccessKeys: true
        });
        if (!result) {
          shouldWarn = false;
          window.close();
        }
      });
      window.webContents.ipc.handle(EDITOR_SETTINGS_UPDATE, (_, liveUpdate) => {
        if (this._window) {
          this._window.webContents.send(EDITOR_SETTINGS_UPDATE, liveUpdate);
        }
      });
      window.webContents.setWindowOpenHandler((detials) => {
        import_electron.shell.openExternal(detials.url);
        return { action: "deny" };
      });
      if (this._window) {
        const listener = () => {
          shouldWarn = false;
          window.close();
        };
        this._window.once("closed", listener);
        window.once("close", () => {
          this._window.off("closed", listener);
          if (type === "custom-css") {
            delete this.windows["custom-css"];
          } else {
            delete this.windows[type][filename];
          }
        });
      }
      if (type === "custom-css") {
        this.windows["custom-css"] = window;
      } else {
        this.windows[type][filename] = window;
      }
    }
    if (!window.webContents.isLoading()) {
      window.show();
    }
    return window.webContents;
  }
  static isValidWindow(item) {
    return item instanceof import_electron.BrowserWindow && !item.isDestroyed();
  }
  static #settings = {
    options: { theme: "vs-dark" },
    liveUpdate: false,
    discordTheme: "dark"
  };
  static updateSettings(settings) {
    this.#settings = settings;
    if (this.isValidWindow(this.windows["custom-css"])) {
      this.windows["custom-css"].webContents.send(EDITOR_SETTINGS_UPDATE, settings);
    }
    for (const type of ["theme", "plugin"]) {
      for (const key in this.windows[type]) {
        if (Object.prototype.hasOwnProperty.call(this.windows[type], key)) {
          const window = this.windows[type][key];
          if (this.isValidWindow(window)) {
            window.webContents.send(EDITOR_SETTINGS_UPDATE, settings);
          }
        }
      }
    }
  }
  static getSettings() {
    return this.#settings;
  }
  static _window;
  static initialize(window) {
    this._window = window;
  }
};

// src/electron/main/modules/ipc.ts
var fs = __toESM(require("fs"));
var path2 = __toESM(require("path"));
var getPath = (event, pathReq) => {
  let returnPath;
  switch (pathReq) {
    case "appPath":
      returnPath = import_electron2.app.getAppPath();
      break;
    case "appData":
    case "userData":
    case "home":
    case "cache":
    case "temp":
    case "exe":
    case "module":
    case "desktop":
    case "documents":
    case "downloads":
    case "music":
    case "pictures":
    case "videos":
    case "recent":
    case "logs":
      returnPath = import_electron2.app.getPath(pathReq);
      break;
    default:
      returnPath = "";
  }
  event.returnValue = returnPath;
};
var openPath = (_, path7) => {
  if (process.platform === "win32") (0, import_child_process.spawn)("explorer.exe", [path7]);
  else import_electron2.shell.openPath(path7);
};
var relaunch = (_, args = []) => {
  import_electron2.app.relaunch({ args: process.argv.slice(1).concat(Array.isArray(args) ? args : [args]) });
  import_electron2.app.quit();
};
var runScript = async (event, script) => {
  try {
    await event.sender.executeJavaScript(`(() => {try {${script}} catch {}})();`);
  } catch {
  }
};
var openDevTools = (event) => event.sender.openDevTools();
var closeDevTools = (event) => event.sender.closeDevTools();
var toggleDevTools = (event) => {
  if (!event.sender.isDevToolsOpened()) openDevTools(event);
  else closeDevTools(event);
};
var createBrowserWindow = (_, url, { windowOptions, closeOnUrl } = {}) => {
  return new Promise((resolve2) => {
    const windowInstance = new import_electron2.BrowserWindow(windowOptions);
    windowInstance.webContents.on("did-navigate", (__, navUrl) => {
      if (navUrl != closeOnUrl) return;
      windowInstance.close();
      resolve2();
    });
    windowInstance.loadURL(url);
  });
};
var inspectElement = async (event) => {
  if (!event.sender.isDevToolsOpened()) {
    event.sender.openDevTools();
    while (!event.sender.isDevToolsOpened()) await new Promise((r) => setTimeout(r, 100));
  }
  event.sender.devToolsWebContents?.executeJavaScript("DevToolsAPI.enterInspectElementMode();");
};
var setMinimumSize = (event, width, height) => {
  const window = import_electron2.BrowserWindow.fromWebContents(event.sender);
  window?.setMinimumSize(width, height);
};
var setWindowSize = (event, width, height) => {
  const window = import_electron2.BrowserWindow.fromWebContents(event.sender);
  window?.setSize(width, height);
};
var getAccentColor = () => {
  return (process.platform == "win32" || process.platform == "darwin") && import_electron2.systemPreferences.getAccentColor() || "";
};
var stopDevtoolsWarning = (event) => event.sender.removeAllListeners("devtools-opened");
var openDialog = (event, options = {}) => {
  const {
    mode = "open",
    openDirectory = false,
    openFile = true,
    multiSelections = false,
    filters,
    promptToCreate = false,
    defaultPath,
    title,
    showOverwriteConfirmation,
    message,
    showHiddenFiles,
    modal = false
  } = options;
  const openFunction = {
    open: import_electron2.dialog.showOpenDialog,
    save: import_electron2.dialog.showSaveDialog
  }[mode];
  if (!openFunction) return Promise.resolve({ error: "Unkown Mode: " + mode });
  return openFunction(...[
    modal && import_electron2.BrowserWindow.fromWebContents(event.sender),
    {
      defaultPath,
      filters,
      title,
      message,
      createDirectory: true,
      properties: [
        showHiddenFiles && "showHiddenFiles",
        openDirectory && "openDirectory",
        promptToCreate && "promptToCreate",
        openDirectory && "openDirectory",
        openFile && "openFile",
        multiSelections && "multiSelections",
        showOverwriteConfirmation && "showOverwriteConfirmation"
      ].filter((e) => e)
    }
  ].filter((e) => e));
};
var registerPreload = (_, path7) => {
  import_electron2.app.commandLine.appendSwitch("preload", path7);
};
var launchDiscord = async (event, opts = {}) => {
  const channel = opts.channel === "canary" ? "canary" : opts.channel === "ptb" ? "ptb" : "stable";
  try {
    if (process.platform === "win32") {
      const baseDir = path2.join(process.env.LOCALAPPDATA || "", channel === "canary" ? "DiscordCanary" : channel === "ptb" ? "DiscordPTB" : "Discord");
      const updateExe = path2.join(baseDir, "Update.exe");
      if (!fs.existsSync(updateExe)) throw new Error(`Update.exe not found: ${updateExe}`);
      let appPath3 = null;
      if (fs.existsSync(baseDir)) {
        const versions2 = fs.readdirSync(baseDir).filter((f) => fs.lstatSync(path2.join(baseDir, f)).isDirectory() && f.startsWith("app-")).sort().reverse();
        if (versions2.length) appPath3 = path2.join(baseDir, versions2[0]);
      }
      const cmdParts = [];
      if (channel !== "stable") cmdParts.push(`set "DISCORD_PRELOAD=${path2.resolve(__dirname, "..", "..", "dist", "preload.js").replace(/"/g, '\\"')}"`);
      if (opts.patchStable && appPath3) cmdParts.push(`set "DISCORD_APP_PATH=${appPath3.replace(/"/g, '\\"')}"`);
      const processName = channel === "canary" ? "DiscordCanary.exe" : channel === "ptb" ? "DiscordPTB.exe" : "Discord.exe";
      const startCmd = `start "" "${updateExe.replace(/"/g, '\\"')}" --processStart "${processName}"`;
      const cmd = cmdParts.length ? `${cmdParts.join(" && ")} && ${startCmd}` : startCmd;
      (0, import_child_process.spawn)("cmd.exe", ["/c", cmd], { detached: true, stdio: "ignore" }).unref();
      return { ok: true };
    }
    if (process.platform === "darwin") {
      const appName = channel === "canary" ? "Discord Canary" : channel === "ptb" ? "Discord PTB" : "Discord";
      const env2 = Object.assign({}, process.env);
      if (channel !== "stable") env2.DISCORD_PRELOAD = path2.resolve(__dirname, "..", "..", "dist", "preload.js");
      (0, import_child_process.spawn)("open", ["-a", appName], { env: env2, detached: true, stdio: "ignore" }).unref();
      return { ok: true };
    }
    const homedir = process.env.XDG_CONFIG_HOME || (process.env.HOME ? path2.join(process.env.HOME, ".config") : "");
    const base = path2.join(homedir, channel === "canary" ? "discordcanary" : channel === "ptb" ? "discordptb" : "discord");
    if (!fs.existsSync(base)) throw new Error(`Cannot find Discord directory: ${base}`);
    const versions = fs.readdirSync(base).filter((f) => fs.lstatSync(path2.join(base, f)).isDirectory() && f.startsWith("app-")).sort().reverse();
    if (!versions.length) throw new Error(`No app-* versions found in ${base}`);
    const bin = path2.join(base, versions[0], "Discord");
    if (!fs.existsSync(bin)) throw new Error(`Discord binary not found at ${bin}`);
    const env = Object.assign({}, process.env);
    if (channel !== "stable") env.DISCORD_PRELOAD = path2.resolve(__dirname, "..", "..", "dist", "preload.js");
    (0, import_child_process.spawn)(bin, { env, detached: true, stdio: "ignore" }).unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
};
var restoreInjection = async (event, opts = {}) => {
  const channel = opts.channel === "canary" ? "canary" : opts.channel === "ptb" ? "ptb" : "stable";
  try {
    if (process.platform !== "win32") return { ok: false, error: "restore only implemented on Windows in this helper" };
    const baseDir = path2.join(process.env.LOCALAPPDATA || "", channel === "canary" ? "DiscordCanary" : channel === "ptb" ? "DiscordPTB" : "Discord");
    let appPath3 = null;
    if (fs.existsSync(baseDir)) {
      const versions = fs.readdirSync(baseDir).filter((f) => fs.lstatSync(path2.join(baseDir, f)).isDirectory() && f.startsWith("app-")).sort().reverse();
      if (versions.length) appPath3 = path2.join(baseDir, versions[0]);
    }
    if (!appPath3) return { ok: false, error: `Could not locate ${channel} app-* directory` };
    const injector = path2.join(__dirname, "..", "..", "..", "scripts", "inject.js");
    if (!fs.existsSync(injector)) return { ok: false, error: `injector script not found: ${injector}` };
    const child = (0, import_child_process.spawn)(process.execPath, [injector, "--restore", "--app", appPath3], { stdio: "ignore", detached: true });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
};
var openEditor = (_, type, filename) => {
  Editor.open(type, filename);
};
var updateSettings = (_, settings) => {
  Editor.updateSettings(settings);
};
var getSettings = (event) => {
  event.returnValue = Editor.getSettings();
};
var IPCMain = class {
  static registerEvents() {
    try {
      import_electron2.ipcMain.on(GET_PATH, getPath);
      import_electron2.ipcMain.on(OPEN_PATH, openPath);
      import_electron2.ipcMain.on(RELAUNCH, relaunch);
      import_electron2.ipcMain.on(OPEN_DEVTOOLS, openDevTools);
      import_electron2.ipcMain.on(CLOSE_DEVTOOLS, closeDevTools);
      import_electron2.ipcMain.on(TOGGLE_DEVTOOLS, toggleDevTools);
      import_electron2.ipcMain.on(INSPECT_ELEMENT, inspectElement);
      import_electron2.ipcMain.on(MINIMUM_SIZE, setMinimumSize);
      import_electron2.ipcMain.on(WINDOW_SIZE, setWindowSize);
      import_electron2.ipcMain.on(DEVTOOLS_WARNING, stopDevtoolsWarning);
      import_electron2.ipcMain.on(REGISTER_PRELOAD, registerPreload);
      import_electron2.ipcMain.on(EDITOR_SETTINGS_GET, getSettings);
      import_electron2.ipcMain.handle(GET_ACCENT_COLOR, getAccentColor);
      import_electron2.ipcMain.handle(RUN_SCRIPT, runScript);
      import_electron2.ipcMain.handle(LAUNCH_DISCORD, launchDiscord);
      import_electron2.ipcMain.handle(INJECTOR_RESTORE, restoreInjection);
      import_electron2.ipcMain.handle(OPEN_DIALOG, openDialog);
      import_electron2.ipcMain.handle(OPEN_WINDOW, createBrowserWindow);
      import_electron2.ipcMain.handle(EDITOR_OPEN, openEditor);
      import_electron2.ipcMain.handle(EDITOR_SETTINGS_UPDATE, updateSettings);
    } catch (err) {
      console.error(err);
    }
  }
};

// src/electron/main/modules/browserwindow.ts
var import_electron5 = __toESM(require("electron"));
var import_path4 = __toESM(require("path"));
init_inaccord();
init_ipcevents();
var BrowserWindow4 = class extends import_electron5.default.BrowserWindow {
  __originalPreload;
  /**
   * @param {import("electron").BrowserWindowConstructorOptions} options
   * @returns
   */
  constructor(options) {
    if (!options) return super(options);
    if (!options.webPreferences) options.webPreferences = {};
    const originalPreload = options.webPreferences.preload ?? null;
    options.webPreferences.preload = import_path4.default.join(__dirname, "preload.js");
    const shouldBeTransparent = InAccord.getSetting("window", "transparency");
    if (typeof shouldBeTransparent === "boolean" && shouldBeTransparent) {
      options.transparent = true;
      options.backgroundColor = "#00000000";
    }
    const inAppTrafficLights = Boolean(InAccord.getSetting("window", "inAppTrafficLights") ?? false);
    process.env.InAccord_NATIVE_FRAME = options.frame = Boolean(InAccord.getSetting("window", "frame") ?? options.frame ?? true);
    process.env.InAccord_IN_APP_TRAFFIC_LIGHTS = inAppTrafficLights;
    if (inAppTrafficLights) {
      delete options.titleBarStyle;
    }
    const removeMinimumSize = Boolean(InAccord.getSetting("window", "removeMinimumSize") ?? false);
    if (removeMinimumSize) {
      options.minWidth = 0;
      options.minHeight = 0;
    }
    super(options);
    if (removeMinimumSize) {
      this.setMinimumSize = () => {
      };
    }
    this.__originalPreload = originalPreload;
    InAccord.setup(this);
    Editor.initialize(this);
    const self = this;
    this.webContents.setWindowOpenHandler = new Proxy(this.webContents.setWindowOpenHandler, {
      apply(target, thisArg, argArray) {
        const handler = argArray[0];
        argArray[0] = function(detials) {
          if (detials.url.startsWith("InAccord://")) {
            self.webContents.send(HANDLE_PROTOCOL, detials.url);
            return { action: "deny" };
          }
          return handler.apply(this, arguments);
        };
        return Reflect.apply(target, thisArg, argArray);
      }
    });
  }
};
Object.assign(BrowserWindow4, import_electron5.default.BrowserWindow);
Object.defineProperty(BrowserWindow4, "name", { value: "BrowserWindow", configurable: true });
var browserwindow_default = class {
  static patchBrowserWindow() {
    const electronPath = require.resolve("electron");
    delete require.cache[electronPath].exports;
    require.cache[electronPath].exports = { ...import_electron5.default, BrowserWindow: BrowserWindow4 };
  }
};

// src/electron/main/modules/csp.ts
var import_electron6 = __toESM(require("electron"));
var csp_default = class {
  static remove() {
    import_electron6.default.session.defaultSession.webRequest.onHeadersReceived(function(detials, callback) {
      if (!detials.responseHeaders) return callback({ cancel: false });
      const headers = Object.keys(detials.responseHeaders);
      for (let h = 0; h < headers.length; h++) {
        const key = headers[h];
        if (key.toLowerCase().indexOf("content-security-policy") !== 0) continue;
        delete detials.responseHeaders[key];
      }
      callback({ cancel: false, responseHeaders: detials.responseHeaders });
    });
  }
};

// src/electron/main/index.ts
try {
  const fs5 = require("fs");
  const path7 = require("path");
  const absPreload = path7.resolve(__dirname, "preload.js");
  fs5.appendFileSync(path7.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] ABSOLUTE_EARLIEST_MAIN_ENTRY
`);
  fs5.appendFileSync(path7.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] ENV: ${JSON.stringify(process.env)}
`);
  fs5.appendFileSync(path7.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] RESOLVED_PRELOAD: ${absPreload}
`);
  process.env.DISCORD_PRELOAD = absPreload;
} catch {
}
try {
  const fs5 = require("fs");
  const path7 = require("path");
  process.on("uncaughtException", (err) => {
    try {
      fs5.appendFileSync(path7.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] UNCAUGHT: ${err && err.stack || err}
`);
    } catch {
    }
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    try {
      fs5.appendFileSync(path7.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] REJECTION: ${reason && reason.stack || reason}
`);
    } catch {
    }
  });
} catch (e) {
}
try {
  const _fs = require("fs");
  const _path = require("path");
  try {
    const info = {
      platform: process.platform,
      argv: process.argv.slice(0, 20),
      env_DISCORD_PRELOAD: process.env.DISCORD_PRELOAD || null,
      env_DISCORD_APP_PATH: process.env.DISCORD_APP_PATH || null
    };
    _fs.appendFileSync(_path.join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] MAIN_START: ${JSON.stringify(info)}
`);
    try {
      const altLog = _path.join(process.cwd(), "dist", "fatal_crash.log");
      _fs.appendFileSync(altLog, `
[${(/* @__PURE__ */ new Date()).toISOString()}] MAIN_START_CWD: ${JSON.stringify(info)}
`);
    } catch {
    }
    try {
      const _os = require("os");
      const tmpLog = _path.join(_os.tmpdir(), "InAccord_fatal_crash.log");
      _fs.appendFileSync(tmpLog, `
[${(/* @__PURE__ */ new Date()).toISOString()}] MAIN_START_TMP: ${JSON.stringify(info)}
`);
    } catch {
    }
  } catch {
  }
} catch {
}
var appPath2 = import_electron7.app.getAppPath();
var oldInstall = import_path5.default.resolve(appPath2, "..", "app");
if (import_fs3.default.existsSync(oldInstall)) {
  import_fs3.default.rmdirSync(oldInstall, { recursive: true });
  import_electron7.app.quit();
  import_electron7.app.relaunch();
}
if (!process.argv.includes("--vanilla")) {
  process.env.NODE_OPTIONS = "--no-force-async-hooks-checks";
  import_electron7.app.commandLine.appendSwitch("no-force-async-hooks-checks");
  browserwindow_default.patchBrowserWindow();
  IPCMain.registerEvents();
  try {
    csp_default.remove();
  } catch {
  }
}
if (!process.argv.includes("--vanilla")) {
  const InAccord2 = (init_inaccord(), __toCommonJS(inaccord_exports)).default;
  InAccord2.disableMediaKeys();
  InAccord2.ensureDirectories();
  try {
    import_electron7.app.on("browser-window-created", (_, bw) => {
      try {
        bw.webContents.once("dom-ready", () => {
          try {
            InAccord2.injectRenderer(bw).catch(() => {
            });
          } catch (e) {
            try {
              require("fs").appendFileSync(require("path").join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] INJECTION_ERROR: ${e && e.stack || e}
`);
            } catch {
            }
          }
        });
      } catch (e) {
        try {
          require("fs").appendFileSync(require("path").join(__dirname, "fatal_crash.log"), `
[${(/* @__PURE__ */ new Date()).toISOString()}] BROWSER_WINDOW_CREATED_HANDLER_ERROR: ${e && e.stack || e}
`);
        } catch {
        }
      }
    });
  } catch (e) {
  }
}
