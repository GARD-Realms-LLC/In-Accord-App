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
var import_fs = __toESM(require("fs"));
var import_path2 = __toESM(require("path"));

// src/electron/preload/patcher.ts
var import_electron = require("electron");
function patcher_default() {
  try {
    if (window.top && window.top !== window) return;
  } catch {
  }
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
  const code = "(" + patcher + ")()";
  try {
    void import_electron.webFrame.executeJavaScript?.(code, true);
  } catch {
  }
  try {
    const wf = import_electron.webFrame;
    if (typeof wf.executeJavaScriptInIsolatedWorld === "function") {
      void wf.executeJavaScriptInIsolatedWorld(0, [{ code }], true);
    }
  } catch {
  }
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
  os: () => os2,
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
var import_buffer = require("buffer");
function readFile(path4, options = "utf8") {
  return fs.readFileSync(path4, options);
}
function writeFile(path4, content, options) {
  if (content instanceof Uint8Array) {
    const Buf = globalThis.Buffer || import_buffer.Buffer;
    content = Buf.from(content);
  }
  const doWriteFile = options?.originalFs ? require("original-fs").writeFileSync : fs.writeFileSync;
  return doWriteFile(path4, content, options);
}
function readDirectory(path4, options) {
  return fs.readdirSync(path4, options);
}
function createDirectory(path4, options) {
  return fs.mkdirSync(path4, options);
}
function deleteDirectory(path4, options) {
  fs.rmdirSync(path4, options);
}
function exists(path4) {
  return fs.existsSync(path4);
}
function getRealPath(path4, options) {
  return fs.realpathSync(path4, options);
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
function createWriteStream2(path4, options) {
  return cloneObject(fs.createWriteStream(path4, options));
}
function watch2(path4, options, callback) {
  const watcher = fs.watch(path4, options, (event, filename) => {
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
function getStats(path4, options) {
  const stats = fs.statSync(path4, options);
  return {
    ...stats,
    isFile: stats.isFile.bind(stats),
    isDirectory: stats.isDirectory.bind(stats),
    isSymbolicLink: stats.isSymbolicLink.bind(stats)
  };
}

// src/electron/preload/api/https.ts
var https = __toESM(require("https"));
var import_buffer2 = require("buffer");
var methods = ["get", "put", "post", "delete", "head"];
var redirectCodes = /* @__PURE__ */ new Set([301, 302, 307, 308]);
var dataToClone = ["statusCode", "statusMessage", "url", "headers", "method", "aborted", "complete", "rawHeaders"];
function safeBufferConcat(chunks) {
  const Buf = globalThis.Buffer || import_buffer2.Buffer;
  try {
    if (Buf && typeof Buf.concat === "function") {
      const list = (chunks || []).map((c) => {
        try {
          if (Buf.isBuffer && Buf.isBuffer(c)) return c;
          return Buf.from(c);
        } catch {
          return Buf.from(String(c ?? ""));
        }
      });
      return Buf.concat(list);
    }
  } catch {
  }
  try {
    const parts = (chunks || []).map((c) => {
      if (c instanceof Uint8Array) return c;
      if (typeof c === "string") return new TextEncoder().encode(c);
      return new Uint8Array(c || []);
    });
    const total = parts.reduce((n, p) => n + (p?.byteLength || 0), 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const p of parts) {
      out.set(p, off);
      off += p.byteLength;
    }
    return import_buffer2.Buffer.from(out);
  } catch {
    return import_buffer2.Buffer.from([]);
  }
}
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
      callback(error, data, safeBufferConcat(chunks));
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
function compileFunction(code, params = [], options = {}) {
  try {
    void options;
    return new Function(...params, code);
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
var http = __toESM(require("http"));
var redirectCodes2 = /* @__PURE__ */ new Set([301, 302, 307, 308]);
function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v)) out[k] = v.join(", ");
    else if (typeof v === "number") out[k] = String(v);
  }
  return out;
}
async function nativeFetch(request3) {
  const requestedUrl = String(request3?.url || "");
  const initial = new URL(requestedUrl);
  if (initial.protocol !== "http:" && initial.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${initial.protocol}`);
  }
  const maxRedirects = Number.isFinite(request3.maxRedirects) ? request3.maxRedirects : 20;
  const timeout = Number.isFinite(request3.timeout) ? request3.timeout : 3e3;
  const redirectMode = request3.redirect ?? "follow";
  const rejectUnauthorized = request3.rejectUnauthorized !== false;
  const doRequest = (url, redirectCount) => {
    return new Promise((resolve, reject) => {
      const Module = url.protocol === "http:" ? http : https2;
      const opts = {
        method: request3.method || "GET",
        headers: request3.headers || {},
        timeout,
        rejectUnauthorized: url.protocol === "https:" ? rejectUnauthorized : void 0
      };
      const req = Module.request(url.href, opts, (res) => {
        const status = res.statusCode ?? 0;
        const statusText = res.statusMessage ?? "";
        if (redirectCodes2.has(status) && res.headers.location && redirectMode !== "manual") {
          const nextCount = redirectCount + 1;
          if (nextCount > maxRedirects) {
            reject(new Error(`Maximum amount of redirects reached (${maxRedirects})`));
            try {
              req.destroy();
            } catch {
            }
            return;
          }
          let nextUrl;
          try {
            nextUrl = new URL(res.headers.location, url);
          } catch (e) {
            reject(e);
            try {
              req.destroy();
            } catch {
            }
            return;
          }
          try {
            res.resume();
          } catch {
          }
          doRequest(nextUrl, nextCount).then(resolve, reject);
          return;
        }
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve({
            url: url.toString(),
            redirected: redirectCount > 0,
            status,
            statusText,
            headers: normalizeHeaders(res.headers),
            body: buf.length ? new Uint8Array(buf) : null
          });
        });
        res.on("error", (err) => reject(err));
      });
      req.on("timeout", () => {
        req.destroy(new Error("Request timed out"));
      });
      req.on("error", (err) => reject(err));
      let removeAbort = null;
      try {
        if (request3.signal) {
          removeAbort = request3.signal.addListener(() => {
            try {
              req.destroy(new Error("Request aborted"));
            } catch {
            }
          });
        }
      } catch {
      }
      try {
        const body = request3.body;
        if (body) {
          req.write(body);
        }
      } catch (e) {
        try {
          removeAbort?.();
        } catch {
        }
        reject(e);
        try {
          req.destroy();
        } catch {
        }
        return;
      } finally {
        req.end();
      }
      req.once("close", () => {
        try {
          removeAbort?.();
        } catch {
        }
      });
    });
  };
  return doRequest(initial, 0);
}

// src/electron/preload/api/index.ts
var path2 = __toESM(require("path"));
var net = __toESM(require("net"));
var os2 = __toESM(require("os"));

// src/electron/preload/api/editor.ts
var editor_exports = {};
__export(editor_exports, {
  onLiveUpdateChange: () => onLiveUpdateChange,
  open: () => open,
  updateSettings: () => updateSettings
});

// src/common/constants/ipcevents.ts
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
  try {
    return import_electron3.ipcRenderer.invoke(EDITOR_SETTINGS_UPDATE, settings).catch((err) => {
      const msg = String(err?.message ?? err);
      if (msg.includes("No handler registered") && msg.includes(EDITOR_SETTINGS_UPDATE)) {
        return null;
      }
      throw err;
    });
  } catch (err) {
    return Promise.resolve(null);
  }
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
var import_os = __toESM(require("os"));
var dataPath = "";
function normalizeReleaseChannel(input) {
  const c = String(input ?? "").trim().toLowerCase();
  if (!c) return "";
  if (c === "stable" || c === "discord") return "stable";
  if (c === "ptb" || c === "discordptb") return "ptb";
  if (c === "canary" || c === "discordcanary") return "canary";
  if (c === "development" || c === "dev" || c === "discorddevelopment") return "development";
  return c;
}
function detectReleaseChannel() {
  const fromEnv = normalizeReleaseChannel(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "");
  if (fromEnv) return fromEnv;
  try {
    const execPath = String(process.execPath || "");
    const exe = import_path.default.basename(execPath).toLowerCase();
    if (exe === "discordptb.exe") return "ptb";
    if (exe === "discordcanary.exe") return "canary";
    if (exe === "discorddevelopment.exe") return "development";
    if (exe === "discord.exe") return "stable";
    const low = execPath.toLowerCase();
    if (low.includes("canary")) return "canary";
    if (low.includes("ptb")) return "ptb";
    if (low.includes("development")) return "development";
  } catch {
  }
  return "stable";
}
var releaseChannel = detectReleaseChannel();
if (!process.env.DISCORD_RELEASE_CHANNEL) process.env.DISCORD_RELEASE_CHANNEL = releaseChannel;
if (process.platform === "win32") {
  const resolveRoamingAppData = () => {
    const candidates = [];
    if (process.env.APPDATA) candidates.push(process.env.APPDATA);
    const userProfile = process.env.USERPROFILE ?? "";
    if (userProfile) candidates.push(import_path.default.join(userProfile, "AppData", "Roaming"));
    try {
      const home = import_os.default.homedir?.() ?? "";
      if (home) candidates.push(import_path.default.join(home, "AppData", "Roaming"));
    } catch {
    }
    for (const c of candidates) {
      try {
        if (c) return c;
      } catch {
      }
    }
    return process.env.APPDATA ?? "";
  };
  const appData = resolveRoamingAppData();
  const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "Discord";
  dataPath = import_path.default.join(appData, base, "InAccord");
} else if (process.platform === "darwin") {
  const home = process.env.HOME ?? "";
  const support = home ? import_path.default.join(home, "Library", "Application Support") : "";
  const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "discord";
  dataPath = import_path.default.join(support, base, "InAccord");
} else {
  const configHome = process.env.XDG_CONFIG_HOME ? process.env.XDG_CONFIG_HOME : import_path.default.join(process.env.HOME, ".config");
  const base = releaseChannel === "ptb" ? "discordptb" : releaseChannel === "canary" ? "discordcanary" : releaseChannel === "development" ? "discorddevelopment" : "discord";
  dataPath = import_path.default.join(configHome, base, "InAccord");
}
dataPath = dataPath + import_path.default.sep;
var _settings;
function getSetting(category, key) {
  if (_settings) return _settings[category]?.[key];
  try {
    const settingsFile = import_path.default.resolve(dataPath, "data", releaseChannel, "settings.json");
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
function init_default() {
  const preload = process.env.DISCORD_PRELOAD;
  if (preload) {
    import_electron6.ipcRenderer.send(REGISTER_PRELOAD, preload);
    const originalKill = process.kill;
    try {
      process.kill = function(_, __) {
        return true;
      };
      require(preload);
    } catch (error) {
      console.error("[InAccord] Failed to run Discord preload", preload, error);
    } finally {
      process.kill = originalKill;
    }
  }
}

// src/electron/preload/index.ts
function injectRendererBundleFromPreload() {
  try {
    try {
      if (window.top && window.top !== window) {
        return;
      }
    } catch {
    }
    const detectChannelId = () => {
      try {
        const exe = String(import_path2.default.basename(process.execPath || "")).toLowerCase();
        if (exe.includes("discordptb")) return "ptb";
        if (exe.includes("discordcanary")) return "canary";
        if (exe.includes("discorddevelopment")) return "development";
      } catch {
      }
      let c = String(process.env.INACCORD_RELEASE_CHANNEL || process.env.DISCORD_RELEASE_CHANNEL || "").toLowerCase();
      if (!c) {
        try {
          const low = String(process.execPath || "").toLowerCase();
          if (low.includes("canary")) c = "canary";
          else if (low.includes("ptb")) c = "ptb";
          else if (low.includes("development")) c = "development";
        } catch {
        }
      }
      if (c === "ptb") return "ptb";
      if (c === "canary") return "canary";
      if (c === "development" || c === "dev") return "development";
      return "stable";
    };
    const channelId = detectChannelId();
    const iaDir = __dirname;
    const injectLogPath = import_path2.default.join(iaDir, `InAccord_inject.${channelId}.log`);
    const preloadLoadedMarkerPath = import_path2.default.join(iaDir, `InAccord.preload_loaded.${channelId}.json`);
    const runningMarkerPath = import_path2.default.join(iaDir, `InAccord.running.${channelId}.json`);
    const injectStatusPath = import_path2.default.join(iaDir, `InAccord.inject_status.${channelId}.json`);
    const logLine = (message) => {
      try {
        try {
          const stat = import_fs.default.existsSync(injectLogPath) ? import_fs.default.statSync(injectLogPath) : null;
          if (stat && stat.size > 2e6) {
            import_fs.default.writeFileSync(injectLogPath, "");
          }
          if (stat) {
            const ageMs = Date.now() - stat.mtimeMs;
            if (Number.isFinite(ageMs) && ageMs > 60 * 60 * 1e3) {
              import_fs.default.writeFileSync(injectLogPath, "");
            }
          }
        } catch {
        }
        import_fs.default.appendFileSync(injectLogPath, `${(/* @__PURE__ */ new Date()).toISOString()} ${message}
`);
      } catch {
      }
    };
    const writeInjectStatus = (status, extra) => {
      try {
        const payload = {
          ts: (/* @__PURE__ */ new Date()).toISOString(),
          pid: process.pid,
          status,
          ...extra || {}
        };
        import_fs.default.writeFileSync(injectStatusPath, JSON.stringify(payload, null, 2));
        try {
          logLine(`[status] wrote ${injectStatusPath} status=${String(status)}`);
        } catch {
        }
      } catch (e) {
        try {
          logLine(`[status] write_failed ${injectStatusPath} err=${String(e?.stack || e?.message || String(e))}`);
        } catch {
        }
      }
    };
    logLine(`[preload] start pid=${process.pid} channel=${channelId} __dirname=${__dirname}`);
    writeInjectStatus("preload-start", { preloadDir: __dirname, iaDir, channelId });
    try {
      const payload = {
        ts: (/* @__PURE__ */ new Date()).toISOString(),
        pid: process.pid,
        preloadDir: __dirname,
        iaDir,
        channelId
      };
      import_fs.default.writeFileSync(preloadLoadedMarkerPath, JSON.stringify(payload, null, 2));
      import_fs.default.writeFileSync(runningMarkerPath, JSON.stringify(payload, null, 2));
      logLine(`[preload] markers_written preload_loaded=${preloadLoadedMarkerPath} running=${runningMarkerPath}`);
    } catch (error) {
      logLine(`[preload] markers_write_failed ${error?.stack || error?.message || String(error)}`);
    }
    try {
      window.addEventListener("error", (ev) => {
        const msg = ev?.error?.stack || ev?.message || "unknown error";
        logLine(`[preload] window.error ${msg}`);
      });
      window.addEventListener("unhandledrejection", (ev) => {
        const reason = ev?.reason;
        const msg = reason?.stack || String(reason ?? "unknown rejection");
        logLine(`[preload] unhandledrejection ${msg}`);
      });
    } catch {
    }
    const bundlePathChannel = import_path2.default.join(__dirname, `InAccord.${channelId}.js`);
    const bundlePathGeneric = import_path2.default.join(__dirname, "InAccord.js");
    const bundlePath = import_fs.default.existsSync(bundlePathChannel) ? bundlePathChannel : bundlePathGeneric;
    logLine(`[preload] bundlePath=${bundlePath} exists=${import_fs.default.existsSync(bundlePath)}`);
    if (!import_fs.default.existsSync(bundlePath)) return;
    let injected = false;
    const maxAttempts = 25;
    let attempts = 0;
    const markInjected = (mode) => {
      try {
        if (window.__INACCORD_INJECTED__) return;
        Object.defineProperty(window, "__INACCORD_INJECTED__", { value: true, configurable: false });
      } catch {
        try {
          window.__INACCORD_INJECTED__ = true;
        } catch {
        }
      }
      try {
        logLine(`[inject] marked_injected mode=${mode}`);
      } catch {
      }
    };
    const inject = () => {
      if (injected) return;
      attempts++;
      try {
        logLine(`[inject] attempt=${attempts}/${maxAttempts} domReadyState=${document.readyState}`);
        try {
          const href = String(window.location?.href || "");
          const proto = String(window.location?.protocol || "");
          const host = String(window.location?.host || "");
          const isDiscordHost = host.includes("discord.com") || host.includes("discordapp.com") || host.includes("canary.discord.com") || host.includes("ptb.discord.com");
          const isDiscordProtocol = proto === "discord:";
          if (!(isDiscordHost || isDiscordProtocol)) {
            writeInjectStatus("waiting-url", { attempts, maxAttempts, href, proto, host });
            if (attempts < maxAttempts) setTimeout(inject, 300);
            return;
          }
          if (proto === "file:") {
            writeInjectStatus("waiting-url", { attempts, maxAttempts, href, proto, host });
            if (attempts < maxAttempts) setTimeout(inject, 300);
            return;
          }
        } catch {
        }
        if (!document.body) {
          logLine(`[inject] body_missing retrying`);
          if (attempts < maxAttempts) setTimeout(inject, 150);
          return;
        }
        try {
          if (!document.getElementById("app-mount")) {
            logLine(`[inject] app-mount missing retrying`);
            writeInjectStatus("waiting-app-mount", { attempts, maxAttempts, readyState: document.readyState });
            if (attempts < maxAttempts) setTimeout(inject, 250);
            return;
          }
        } catch {
        }
        let code = "";
        try {
          code = import_fs.default.readFileSync(bundlePath, "utf8");
        } catch (e) {
          logLine(`[inject] read_bundle_failed ${e?.stack || e?.message || String(e)}`);
          return;
        }
        const wrapped = `(() => {
try {
  if (window.__INACCORD_INJECTED__) return 'already';
  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','running'); } catch {}
  try { document.documentElement && document.documentElement.removeAttribute('data-inaccord-error'); } catch {}
${code}
  try { Object.defineProperty(window, '__INACCORD_INJECTED__', {value: true, configurable: false}); } catch {}
  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','ok'); } catch {}
  return 'ok';
} catch (e) {
  const msg = (e?.stack || e?.message || String(e));
  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-status','error'); } catch {}
  try { document.documentElement && document.documentElement.setAttribute('data-inaccord-error', String(msg).slice(0, 500)); } catch {}
  return 'error:' + msg;
}
})()`;
        const readMainWorldStatus = () => {
          try {
            const s = document.documentElement?.getAttribute?.("data-inaccord-status") || "";
            const e = document.documentElement?.getAttribute?.("data-inaccord-error") || "";
            const r = document.documentElement?.getAttribute?.("data-inaccord-renderer") || "";
            const re = document.documentElement?.getAttribute?.("data-inaccord-startup-error") || "";
            const stage = document.documentElement?.getAttribute?.("data-inaccord-startup-stage") || "";
            const attempt = document.documentElement?.getAttribute?.("data-inaccord-startup-attempt") || "";
            const detail = document.documentElement?.getAttribute?.("data-inaccord-startup-error-detail") || "";
            return {
              status: String(s),
              error: String(e),
              renderer: String(r),
              rendererError: String(re),
              startupStage: String(stage),
              startupAttempt: String(attempt),
              startupErrorDetail: String(detail)
            };
          } catch {
            return { status: "", error: "", renderer: "", rendererError: "", startupStage: "", startupAttempt: "", startupErrorDetail: "" };
          }
        };
        const execInMainWorld = async () => {
          const wf = import_electron7.webFrame;
          const probe = `(() => {
  try {
    const hasChunk = !!(window && (window.webpackChunkdiscord_app || window.__webpack_require__));
    const hasDoc = !!(document && document.getElementById && document.getElementById('app-mount'));
    return { ok: true, hasChunk, hasDoc, href: String(location && location.href || '') };
  } catch (e) {
    return { ok: false, error: String(e && (e.stack || e.message) || e) };
  }
})()`;
          const tryExec = async (mode, js) => {
            if (mode === "executeJavaScript") {
              const r = await wf.executeJavaScript(js, true);
              return { mode, result: r };
            }
            if (typeof wf.executeJavaScriptInIsolatedWorld === "function") {
              const r = await wf.executeJavaScriptInIsolatedWorld(0, [{ code: js }], true);
              const first = Array.isArray(r) ? r[0] : r;
              return { mode, result: first };
            }
            throw new Error("executeJavaScriptInIsolatedWorld unavailable");
          };
          let preferred = "executeJavaScript";
          try {
            const p1 = (await tryExec("executeJavaScript", probe))?.result;
            if (p1 && typeof p1 === "object" && p1.hasChunk) preferred = "executeJavaScript";
            else {
              const p2 = (await tryExec("executeJavaScriptInIsolatedWorld:0", probe))?.result;
              if (p2 && typeof p2 === "object" && p2.hasChunk) preferred = "executeJavaScriptInIsolatedWorld:0";
            }
          } catch {
          }
          const exec = await tryExec(preferred, wrapped);
          return exec;
        };
        void Promise.resolve(execInMainWorld()).then((ret) => {
          const mode = String(ret?.mode || "unknown");
          const st = readMainWorldStatus();
          const result = String(ret?.result);
          if (result.startsWith("error:") || st.status === "error") {
            const errText = result.startsWith("error:") ? result.slice("error:".length) : st.error || "unknown";
            logLine(`[inject] ${mode} error ${errText}`);
            writeInjectStatus("error", { mode, attempts, maxAttempts, error: errText, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail });
            if (attempts < maxAttempts) {
              setTimeout(inject, Math.min(250 + attempts * 250, 2e3));
            }
          } else if (st.status === "ok" || result === "ok" || result === "already") {
            injected = true;
            markInjected(mode);
            logLine(`[inject] ${mode} ok ret=${result}`);
            writeInjectStatus("ok", { mode, attempts, maxAttempts, result, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail });
            const post = (delayMs) => {
              try {
                setTimeout(() => {
                  try {
                    const s2 = readMainWorldStatus();
                    const stage = String(s2.startupStage || "");
                    const renderer = String(s2.renderer || "");
                    const rendererErr = String(s2.rendererError || "");
                    const detail = String(s2.startupErrorDetail || "");
                    if (renderer === "startup-complete") {
                      writeInjectStatus("startup-complete", { mode, stage, renderer, rendererError: rendererErr });
                    } else if (renderer === "startup-error") {
                      writeInjectStatus("startup-error", { mode, stage, renderer, rendererError: rendererErr, startupErrorDetail: detail });
                    } else {
                      writeInjectStatus("startup-progress", { mode, stage, renderer, rendererError: rendererErr });
                    }
                  } catch {
                  }
                }, Math.max(0, delayMs | 0));
              } catch {
              }
            };
            post(1500);
            post(6e3);
            post(15e3);
          } else {
            logLine(`[inject] ${mode} not_ready status=${st.status || ""} ret=${result}`);
            writeInjectStatus("not-ready", { mode, attempts, maxAttempts, status: st.status || "", result, renderer: st.renderer, rendererError: st.rendererError, startupStage: st.startupStage, startupAttempt: st.startupAttempt, startupErrorDetail: st.startupErrorDetail });
            if (attempts < maxAttempts) {
              setTimeout(inject, Math.min(250 + attempts * 250, 2e3));
            }
          }
        }).catch((e) => {
          logLine(`[inject] executeJavaScript_failed ${e?.stack || e?.message || String(e)}`);
          writeInjectStatus("exec-failed", { attempts, maxAttempts, error: String(e?.stack || e?.message || String(e)) });
          if (attempts < maxAttempts) {
            setTimeout(inject, Math.min(250 + attempts * 250, 2e3));
          }
        });
      } catch (error) {
        logLine(`[inject] exception ${error?.stack || error?.message || String(error)}`);
        if (attempts < maxAttempts) {
          setTimeout(inject, Math.min(250 + attempts * 250, 2e3));
        }
      }
    };
    if (document.readyState === "loading") {
      window.addEventListener("DOMContentLoaded", inject, { once: true });
    } else {
      inject();
    }
  } catch (error) {
    console.error("[InAccord] preload bundle setup failed", error);
  }
}
try {
  patcher_default();
} catch (error) {
  console.error("[InAccord] patchDefine failed", error);
}
try {
  discordnativepatch_default.init();
} catch (error) {
  console.error("[InAccord] DiscordNativePatch init failed", error);
}
var hasInitialized = false;
import_electron7.contextBridge.exposeInMainWorld("process", process_default);
import_electron7.contextBridge.exposeInMainWorld("InAccordPreload", () => {
  if (!hasInitialized) hasInitialized = true;
  return api_exports;
});
try {
  init_default();
} catch (error) {
  console.error("[InAccord] preload init failed", error);
}
injectRendererBundleFromPreload();
