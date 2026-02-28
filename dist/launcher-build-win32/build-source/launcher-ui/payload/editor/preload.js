"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/editor/preload.ts
var import_electron = __toESM(require("electron"));
var import_fs = __toESM(require("fs"));
var import_path = __toESM(require("path"));

// src/common/constants/ipcevents.ts
var GET_PATH = "ia-get-path";
var EDITOR_SHOULD_SHOW_WARNING = "ia-editor-show-warning";
var EDITOR_SETTINGS_GET = "ia-editor-settings-get";
var EDITOR_SETTINGS_UPDATE = "ia-editor-settings-update";

// src/editor/preload.ts
var dataPath = "";
if (process.platform === "win32" || process.platform === "darwin") dataPath = import_path.default.join(import_electron.default.ipcRenderer.sendSync(GET_PATH, "userData"), "..");
else dataPath = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : import_path.default.join(process.env.HOME, ".config");
dataPath = import_path.default.join(dataPath, "InAccord") + "/";
var query = new URLSearchParams(location.search);
var type = query.get("type");
var filename = query.get("filename");
var filepath;
if (type === "custom-css") {
  filepath = import_path.default.join(dataPath, "data", process.env.DISCORD_RELEASE_CHANNEL, "custom.css");
} else {
  filepath = import_path.default.join(dataPath, `${type}s`, filename);
}
import_electron.default.contextBridge.exposeInMainWorld("Editor", {
  type,
  filename,
  filepath,
  read() {
    return import_fs.default.readFileSync(filepath, "utf-8");
  },
  open() {
    import_electron.default.shell.openPath(filepath);
  },
  write(contents) {
    import_fs.default.writeFileSync(filepath, contents, "utf-8");
  },
  shouldShowWarning(showWarning) {
    import_electron.default.ipcRenderer.invoke(EDITOR_SHOULD_SHOW_WARNING, showWarning);
  },
  readText() {
    return import_electron.default.clipboard.readText();
  },
  settings: {
    get: () => import_electron.ipcRenderer.sendSync(EDITOR_SETTINGS_GET),
    subscribe(listener) {
      import_electron.default.ipcRenderer.on(EDITOR_SETTINGS_UPDATE, (event, settings) => {
        listener(settings);
      });
    },
    setLiveUpdate(state) {
      import_electron.default.ipcRenderer.invoke(EDITOR_SETTINGS_UPDATE, state);
    }
  }
});
