"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/electron/preload/index.ts
var import_electron7 = require("electron");
var import_fs2 = __toESM(require("fs"));
var import_path3 = __toESM(require("path"));

// src/electron/preload/patcher.ts
var import_electron = require("electron");
function patcher_default() {
  const patcher = function() {
    const chunkName = "webpackChunkdiscord_app";
    const predefine = function(target, prop, effect) {
      const value = target[prop];
      Object.defineProperty(target, prop, {
        get() {
          return value;
        },
        set(newValue) {
          Object.defineProperty(target, prop, {
            value: newValue,
            configurable: true,
            enumerable: true,
            writable: true
          });
          try {
            effect(newValue);
          } catch (error) {
            console.error(error);
          }
          return newValue;
        },
        configurable: true
      });
    };
    if (!Reflect.has(window, chunkName)) {
      predefine(window, chunkName, (instance) => {
        instance.push([[/* @__PURE__ */ Symbol()], {}, (require2) => {
          require2.d = (target, exports2) => {
            for (const key in exports2) {
              if (!Reflect.has(exports2, key)) continue;
              try {
                Object.defineProperty(target, key, {
                  get: () => exports2[key](),
                  set: (v) => {
                    exports2[key] = () => v;
                  },
                  enumerable: true,
                  configurable: true
                });
              } catch (error) {
                console.error(error);
              }
            }
          };
        }]);
      });
    }
  };
  import_electron.webFrame.top?.executeJavaScript("(" + patcher + ")()");
}

// src/common/utils/clone.ts
function getKeys(object) {
  const keys = [];
  for (const key in object) keys.push(key);
  return keys;
}
function cloneObject(target, newObject = {}, keys) {
  if (!Array.isArray(keys)) keys = getKeys(target);
  return keys.reduce((clone, key) => {
    if (typeof target[key] === "object" && !Array.isArray(target[key]) && target[key] !== null) clone[key] = cloneObject(target[key], {});
    else if (typeof target[key] === "function") clone[key] = target[key].bind(target);
    else clone[key] = target[key];
    return clone;
  }, newObject);
}

// src/electron/preload/process.ts
var newProcess = cloneObject(process, {}, getKeys(process).filter((p) => p !== "config"));
newProcess.versions.nodejs = newProcess.versions.node;
delete newProcess.versions.node;
newProcess.isWeb = true;
var process_default = newProcess;

// src/electron/preload/api/index.ts
var api_exports = {};
__export(api_exports, {
  addProtocolListener: () => addProtocolListener,
  crypto: () => crypto_exports,
  editor: () => editor_exports,
  electron: () => electron_exports,
  filesystem: () => filesystem_exports,
  https: () => https_default,
  nativeFetch: () => nativeFetch,
  net: () => net,
  os: () => os,
  path: () => path2,
  setDevToolsWarningState: () => setDevToolsWarningState,
  vm: () => vm_exports
});

// src/electron/preload/api/filesystem.ts
var filesystem_exports = {};
__export(filesystem_exports, {
  createDirectory: () => createDirectory,
  createWriteStream: () => createWriteStream2,
  deleteDirectory: () => deleteDirectory,
  exists: () => exists,
  getRealPath: () => getRealPath,
  getStats: () => getStats,
  readDirectory: () => readDirectory,
  readFile: () => readFile,
  rename: () => rename,
  renameSync: () => renameSync2,
  rm: () => rm,
  rmSync: () => rmSync2,
  unlinkSync: () => unlinkSync2,
  watch: () => watch2,
  writeFile: () => writeFile
});
var fs = __toESM(require("fs"));

// src/common/logger.ts
var LogTypes = {
  /** Alias for error */
  err: "error",
  error: "error",
  /** Alias for debug */
  dbg: "debug",
  debug: "debug",
  log: "log",
  warn: "warn",
  info: "info"
};
var Logger = class _Logger {
  /**
   * Logs an error using a collapsed error group with stacktrace.
   *
   * @param {string} module - Name of the calling module.
   * @param {string} message - Message or error to have logged.
   * @param {any} error - Error object to log with the message.
   */
  static stacktrace(module2, message, error) {
    console.error(`%c[${module2}]%c ${message}

%c`, "color: #3a71c1; font-weight: 700;", "color: red; font-weight: 700;", "color: red;", error);
  }
  /**
   * Logs using error formatting. For logging an actual error object consider {@link module:Logger.stacktrace}
   *
   * @param {string} module - Name of the calling module.
   * @param {any[]} message - Messages to have logged.
   */
  static err(module2, ...message) {
    _Logger._log(module2, message, "error");
  }
  /**
   * Alias for "err"
   * @param {string} module NAme of the calling module
   * @param  {...any} message Messages to have logged.
   */
  static error(module2, ...message) {
    _Logger._log(module2, message, "error");
  }
  /**
   * Logs a warning message.
   *
   * @param {string} module - Name of the calling module.
   * @param {...any} message - Messages to have logged.
   */
  static warn(module2, ...message) {
    _Logger._log(module2, message, "warn");
  }
  /**
   * Logs an informational message.
   *
   * @param {string} module - Name of the calling module.
   * @param {...any} message - Messages to have logged.
   */
  static info(module2, ...message) {
    _Logger._log(module2, message, "info");
  }
  /**
   * Logs used for debugging purposes.
   *
   * @param {string} module - Name of the calling module.
   * @param {...any} message - Messages to have logged.
   */
  static debug(module2, ...message) {
    _Logger._log(module2, message, "debug");
  }
  /**
   * Logs used for basic loggin.
   *
   * @param {string} module - Name of the calling module.
   * @param {...any} message - Messages to have logged.
   */
  static log(module2, ...message) {
    _Logger._log(module2, message);
  }
  /**
   * Logs strings using different console levels and a module label.
   *
   * @param {string} module - Name of the calling module.
   * @param {any|Array<any>} message - Messages to have logged.
   * @param {module:Logger.LogTypes} type - Type of log to use in console.
   */
  static _log(module2, message, type = "log") {
    const parsedType = _Logger.parseType(type);
    if (!Array.isArray(message)) message = [message];
    console[parsedType](`%c[InAccord]%c [${module2}]%c`, "color: #3E82E5; font-weight: 700;", "color: #3a71c1;", "", ...message);
  }
  static parseType(type) {
    return LogTypes[type] || "log";
  }
};

// src/electron/preload/api/filesystem.ts
function readFile(path5, options = "utf8") {
  return fs.readFileSync(path5, options);
}
function writeFile(path5, content, options) {
  if (content instanceof Uint8Array) {
    content = Buffer.from(content);
  }
  const doWriteFile = options?.originalFs ? require("original-fs").writeFileSync : fs.writeFileSync;
  return doWriteFile(path5, content, options);
}
function readDirectory(path5, options) {
  return fs.readdirSync(path5, options);
}
function createDirectory(path5, options) {
  return fs.mkdirSync(path5, options);
}
function deleteDirectory(path5, options) {
  fs.rmdirSync(path5, options);
}
function exists(path5) {
  return fs.existsSync(path5);
}
function getRealPath(path5, options) {
  return fs.realpathSync(path5, options);
}
function rename(oldPath, newPath) {
  return fs.renameSync(oldPath, newPath);
}
function renameSync2(oldPath, newPath) {
  return fs.renameSync(oldPath, newPath);
}
function rm(pathToFile) {
  return fs.rmSync(pathToFile);
}
function rmSync2(pathToFile) {
  return fs.rmSync(pathToFile);
}
function unlinkSync2(fileToDelete) {
  return fs.unlinkSync(fileToDelete);
}
function createWriteStream2(path5, options) {
  return cloneObject(fs.createWriteStream(path5, options));
}
function watch2(path5, options, callback) {
  const watcher = fs.watch(path5, options, (event, filename) => {
    try {
      callback(event, filename);
    } catch (error) {
      Logger.stacktrace("filesystem", "Fialed to watch path", error);
    }
  });
  return {
    close: () => {
      watcher.close();
    }
  };
}
function getStats(path5, options) {
  const stats = fs.statSync(path5, options);
  return {
    ...stats,
    isFile: stats.isFile.bind(stats),
    isDirectory: stats.isDirectory.bind(stats),
    isSymbolicLink: stats.isSymbolicLink.bind(stats)
  };
}

// src/electron/preload/api/https.ts
var fs2 = require("fs");
var https = __toESM(require("https"));
var http = require("http");
var methods = ["get", "put", "post", "delete", "head"];
var redirectCodes = /* @__PURE__ */ new Set([301, 302, 307, 308]);
var dataToClone = ["statusCode", "statusMessage", "url", "headers", "method", "aborted", "complete", "rawHeaders"];
var makeRequest = (url, options, callback, setReq) => {
  const req = https.request(url, Object.assign({ method: "GET" }, options), (res) => {
    if (redirectCodes.has(res.statusCode ?? 0) && res.headers.location) {
      const final = new URL(res.headers.location);
      for (const [key, value] of new URL(url).searchParams.entries()) {
        final.searchParams.set(key, value);
      }
      return makeRequest(final.toString(), options, callback, setReq);
    }
    const chunks = [];
    let error = null;
    setReq(res, req);
    res.addListener("error", (err) => {
      error = err;
    });
    res.addListener("data", (chunk) => {
      chunks.push(chunk);
    });
    res.addListener("end", () => {
      const data = Object.fromEntries(dataToClone.map((h) => [h, res[h]]));
      callback(error, data, Buffer.concat(chunks));
      req.end();
    });
  });
  if (options.formData) {
    try {
      req.write(options.formData);
    } finally {
      req.end();
    }
  } else {
    req.end();
  }
  req.on("error", (error) => callback(error));
};
var request2 = function(url, options, callback) {
  let responseObject = null;
  let reqObject = null;
  let pipe = null;
  makeRequest(url, options, callback, (res, req) => {
    reqObject = req;
    responseObject = res;
    if (pipe) {
      res.pipe(pipe);
    }
  });
  return {
    end() {
      reqObject?.end();
    },
    pipe(fsStream) {
      if (!responseObject) {
        pipe = fsStream;
      } else {
        responseObject.pipe(fsStream);
      }
    }
  };
};
var https_default = Object.assign(
  { request: request2 },
  Object.fromEntries(methods.map((method) => [
    method,
    function(...args) {
      args[1] ??= {};
      args[1].method ??= method.toUpperCase();
      return Reflect.apply(request2, this, args);
    }
  ]))
);

// src/electron/preload/api/electron.ts
var electron_exports = {};
__export(electron_exports, {
  ipcRenderer: () => ipcRenderer,
  shell: () => import_electron2.shell,
  webUtils: () => import_electron2.webUtils
});
var import_electron2 = require("electron");
var ipcRenderer = {
  send: import_electron2.ipcRenderer.send.bind(import_electron2.ipcRenderer),
  sendToHost: import_electron2.ipcRenderer.sendToHost.bind(import_electron2.ipcRenderer),
  sendSync: import_electron2.ipcRenderer.sendSync.bind(import_electron2.ipcRenderer),
  invoke: import_electron2.ipcRenderer.invoke.bind(import_electron2.ipcRenderer),
  on: import_electron2.ipcRenderer.on.bind(import_electron2.ipcRenderer),
  off: import_electron2.ipcRenderer.off.bind(import_electron2.ipcRenderer)
};

// src/electron/preload/api/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  createHash: () => createHash,
  randomBytes: () => randomBytes
});
var crypto = /* @__PURE__ */ (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    return cache = require("crypto");
  };
})();
function createHash(type) {
  const hash = crypto().createHash(type);
  const ctx = {
    update(data) {
      hash.update(data);
      return ctx;
    },
    digest(encoding) {
      return hash.digest(encoding);
    }
  };
  return ctx;
}
function randomBytes(length) {
  return crypto().randomBytes(length);
}

// src/electron/preload/api/vm.ts
var vm_exports = {};
__export(vm_exports, {
  compileFunction: () => compileFunction
});
var import_vm = __toESM(require("vm"));
function compileFunction(code, params = [], options = {}) {
  try {
    return import_vm.default.compileFunction(code, params, options);
  } catch (e) {
    const error = e;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
}

// src/electron/preload/api/fetch.ts
var https2 = __toESM(require("https"));
var http2 = __toESM(require("http"));
var MAX_DEFAULT_REDIRECTS = 20;
var redirectCodes2 = /* @__PURE__ */ new Set([301, 302, 307, 308]);
function nativeFetch(requestedUrl, fetchOptions) {
  let state = "PENDING";
  const data = { content: [], headers: void 0, statusCode: void 0, url: requestedUrl, statusText: "", redirected: false };
  const finishListeners = /* @__PURE__ */ new Set();
  const errorListeners = /* @__PURE__ */ new Set();
  const execute = (url, options, redirectCount = 0) => {
    const Module = url.protocol === "http:" ? http2 : https2;
    const req = Module.request(url.href, {
      headers: options.headers ?? {},
      method: options.method ?? "GET",
      timeout: options.timeout ?? 3e3
    }, (res) => {
      if (redirectCodes2.has(res.statusCode ?? 0) && res.headers.location && options.redirect !== "manual") {
        redirectCount++;
        if (redirectCount >= (options.maxRedirects ?? MAX_DEFAULT_REDIRECTS)) {
          state = "ABORTED";
          const error = new Error(`Maximum amount of redirects reached (${options.maxRedirects ?? MAX_DEFAULT_REDIRECTS})`);
          errorListeners.forEach((e) => e(error));
          return;
        }
        let final;
        try {
          final = new URL(res.headers.location);
        } catch (error) {
          state = "ABORTED";
          errorListeners.forEach((e) => e(error));
          return;
        }
        for (const [key, value] of new URL(url).searchParams.entries()) {
          final.searchParams.set(key, value);
        }
        return execute(final, options, redirectCount);
      }
      res.on("data", (chunk) => data.content.push(chunk));
      res.on("end", () => {
        data.content = Buffer.concat(data.content);
        data.headers = res.headers;
        data.statusCode = res.statusCode;
        data.url = url.toString();
        data.statusText = res.statusMessage;
        data.redirected = redirectCount > 0;
        state = "DONE";
        finishListeners.forEach((listener) => listener());
      });
      res.on("error", (error) => {
        state = "ABORTED";
        errorListeners.forEach((e) => e(error));
      });
    });
    req.on("timeout", () => {
      const error = new Error("Request timed out");
      req.destroy(error);
    });
    req.on("error", (error) => {
      state = "ABORTED";
      errorListeners.forEach((e) => e(error));
    });
    if (options.body) {
      try {
        req.write(options.body);
      } catch (error) {
        state = "ABORTED";
        errorListeners.forEach((e) => e(error));
      } finally {
        req.end();
      }
    } else {
      req.end();
    }
    if (options.signal) {
      options.signal.addEventListener("abort", () => {
        req.end();
        state = "ABORTED";
      });
    }
  };
  const parsed = new URL(requestedUrl);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  execute(parsed, fetchOptions);
  return {
    onComplete(listener) {
      finishListeners.add(listener);
    },
    onError(listener) {
      errorListeners.add(listener);
    },
    readData() {
      switch (state) {
        case "PENDING":
          throw new Error("Cannot read data before request is done!");
        case "ABORTED":
          throw new Error("Request was aborted.");
        case "DONE":
          return data;
      }
    }
  };
}

// src/electron/preload/api/index.ts
var path2 = __toESM(require("path"));
var net = __toESM(require("net"));
var os = __toESM(require("os"));

// src/electron/preload/api/editor.ts
var editor_exports = {};
__export(editor_exports, {
  onLiveUpdateChange: () => onLiveUpdateChange,
  open: () => open,
  updateSettings: () => updateSettings
});

// src/common/constants/ipcevents.ts
var GET_PATH = "ia-get-path";
var REGISTER_PRELOAD = "ia-register-preload";
var HANDLE_PROTOCOL = "ia-handle-protocol";
var EDITOR_OPEN = "ia-editor-open";
var EDITOR_SETTINGS_UPDATE = "ia-editor-settings-update";

// src/electron/preload/api/editor.ts
var import_electron3 = require("electron");
function open(type, filename) {
  import_electron3.ipcRenderer.invoke(EDITOR_OPEN, type, filename);
}
function updateSettings(settings) {
  import_electron3.ipcRenderer.invoke(EDITOR_SETTINGS_UPDATE, settings);
}
function onLiveUpdateChange(listener) {
  function callback(_, state) {
    listener(state);
  }
  import_electron3.ipcRenderer.on(EDITOR_SETTINGS_UPDATE, callback);
  return () => {
    import_electron3.ipcRenderer.off(EDITOR_SETTINGS_UPDATE, callback);
  };
}

// src/electron/preload/api/index.ts
var import_electron5 = __toESM(require("electron"));

// src/electron/preload/discordnativepatch.ts
var import_electron4 = __toESM(require("electron"));
var import_path = __toESM(require("path"));
var dataPath = "";
if (process.platform === "win32" || process.platform === "darwin") dataPath = import_path.default.join(import_electron4.default.ipcRenderer.sendSync(GET_PATH, "userData"), "..");
else dataPath = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : import_path.default.join(process.env.HOME, ".config");
dataPath = import_path.default.join(dataPath, "InAccord") + "/";
var _settings;
function getSetting(category, key) {
  if (_settings) return _settings[category]?.[key];
  try {
    const settingsFile = import_path.default.resolve(dataPath, "data", process.env.DISCORD_RELEASE_CHANNEL, "settings.json");
    _settings = require(settingsFile) ?? {};
    return _settings[category]?.[key];
  } catch {
    _settings = {};
    return _settings[category]?.[key];
  }
}
var { exposeInMainWorld } = import_electron4.default.contextBridge;
var onOpened;
var onClosed;
var isOpen = false;
var patchDevtoolsCallbacks = getSetting("developer", "devToolsWarning");
if (typeof patchDevtoolsCallbacks !== "boolean") patchDevtoolsCallbacks = false;
var contextBridge = {
  ...import_electron4.default.contextBridge,
  exposeInMainWorld(apiKey, api) {
    if (apiKey === "DiscordNative") {
      api.window.USE_OSX_NATIVE_TRAFFIC_LIGHTS = process.platform === "darwin" && process.env.InAccord_IN_APP_TRAFFIC_LIGHTS === "false";
      api.window.setDevtoolsCallbacks(
        () => {
          isOpen = true;
          if (!patchDevtoolsCallbacks) onOpened?.();
        },
        () => {
          isOpen = false;
          if (!patchDevtoolsCallbacks) onClosed?.();
        }
      );
      api.window.setDevtoolsCallbacks = (_onOpened, _onClosed) => {
        onOpened = _onOpened;
        onClosed = _onClosed;
      };
    }
    exposeInMainWorld(apiKey, api);
  }
};
var DiscordNativePatch = class {
  static setDevToolsWarningState(value) {
    patchDevtoolsCallbacks = value;
    if (isOpen) {
      if (value) onClosed?.();
      else onOpened?.();
    }
  }
  // For native frame
  // document.body does not exist when this is ran.
  // so we have to wiat for it
  static injectCSS() {
    if (process.env.InAccord_NATIVE_FRAME === "false") return;
    const mutationObserver = new global.MutationObserver(() => {
      if (global.document.body) {
        mutationObserver.disconnect();
        const style = global.document.createElement("style");
        style.textContent = `
                    #app-mount > div[class*=titleBar_], div[class*="-winButtons"] { display: none !important; }
                    .platform-osx nav[class*=wrapper_][class*=guilds_] {margin-top: 0;}
                    .platform-win div[class*=content_] > div[class*=sidebar_] {border-radius: 0;}
                `;
        global.document.body.append(style);
      }
    });
    mutationObserver.observe(global.document, { childList: true, subtree: true });
  }
  static patch() {
    const electronPath = require.resolve("electron");
    delete require.cache[electronPath].exports;
    require.cache[electronPath].exports = { ...import_electron4.default, contextBridge };
  }
  static init() {
    this.injectCSS();
    this.patch();
  }
};
var discordnativepatch_default = DiscordNativePatch;

// src/electron/preload/api/index.ts
var { InAccord_PROTOCOL } = process.env;
delete process.env.InAccord_PROTOCOL;
function addProtocolListener(callback) {
  if (InAccord_PROTOCOL) {
    process.nextTick(() => callback(InAccord_PROTOCOL));
  }
  import_electron5.default.ipcRenderer.on(HANDLE_PROTOCOL, (_, url) => callback(url));
}
function setDevToolsWarningState(value) {
  discordnativepatch_default.setDevToolsWarningState(value);
}

// src/electron/preload/init.ts
var import_electron6 = require("electron");
var import_fs = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));
function init_default() {
  try {
    const marker = import_path2.default.join(__dirname, "preload_loaded.log");
    import_fs.default.appendFileSync(marker, `[${(/* @__PURE__ */ new Date()).toISOString()}] preload init executed
`);
  } catch {
  }
  const preload = process.env.DISCORD_PRELOAD;
  if (preload) {
    import_electron6.ipcRenderer.send(REGISTER_PRELOAD, preload);
    try {
      const originalKill = process.kill;
      process.kill = function(_, __) {
        return true;
      };
      try {
        const resolvedTarget = require("path").resolve(preload);
        const self = require("path").resolve(__filename);
        if (resolvedTarget !== self) {
          require(resolvedTarget);
        } else {
          try {
            import_fs.default.appendFileSync(import_path2.default.join(__dirname, "preload_loaded.log"), `[${(/* @__PURE__ */ new Date()).toISOString()}] skipped self-require
`);
          } catch {
          }
        }
      } catch {
      }
      process.kill = originalKill;
    } catch {
    }
  }
}

// src/electron/preload/index.ts
try {
  const originalPreload = process.env.DISCORD_PRELOAD;
  if (typeof originalPreload === "string" && originalPreload.length) {
    const resolvedOriginal = import_path3.default.resolve(originalPreload);
    const resolvedOurPreload = import_path3.default.resolve(import_path3.default.join(__dirname, "preload.js"));
    if (resolvedOriginal !== resolvedOurPreload && import_fs2.default.existsSync(resolvedOriginal)) {
      require(resolvedOriginal);
    }
  }
} catch {
}
patcher_default();
discordnativepatch_default.init();
var hasInitialized = false;
import_electron7.contextBridge.exposeInMainWorld("process", process_default);
import_electron7.contextBridge.exposeInMainWorld("InAccordPreload", () => {
  if (hasInitialized) return null;
  hasInitialized = true;
  return api_exports;
});
init_default();
