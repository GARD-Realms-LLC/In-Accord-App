import Remote from "./remote";
import type {RequestOptions} from "node:http";


const methods = ["get", "put", "post", "delete", "head"];
const aliases = {del: "delete"};

function parseArguments(...args: any) {
    let url, options, callback;

    for (const arg of args) {
        switch (typeof arg) {
            case (arg !== null && "object"):
                options = arg;
                if ("url" in options) {
                    url = options.url;
                }
                break;

            case (!url && "string"):
                url = arg;
                break;

            case (!callback && "function"):
                callback = arg;
                break;
        }
    }

    return {url, options, callback};
}


function validUrl(url: unknown): url is string {
    return typeof url === "string";
}

function validCallback(callback: unknown): callback is ((...a: any[]) => any) {
    return typeof callback === "function";
}

function normalizeContentType(headers: any): string {
    try {
        const h: any = headers || {};
        const v = h["Content-Type"] ?? h["content-type"] ?? "";
        return String(v || "").toLowerCase();
    }
    catch {
        return "";
    }
}

function toUint8Array(body: any): Uint8Array {
    try {
        if (body == null) return new Uint8Array();
        if (body instanceof Uint8Array) return body;
        if (typeof body === "string") return new TextEncoder().encode(body);
        // Handles ArrayBuffer, array-like, and Node Buffers (which are Uint8Array anyway).
        return new Uint8Array(body);
    }
    catch {
        try {
            return new TextEncoder().encode(String(body ?? ""));
        }
        catch {
            return new Uint8Array();
        }
    }
}

function toText(body: any): string {
    try {
        if (body == null) return "";
        if (typeof body === "string") return body;
        if (body instanceof Uint8Array) {
            try {
                return new TextDecoder("utf-8").decode(body);
            }
            catch {
                // Best-effort fallback.
                return String(body);
            }
        }
        return String(body);
    }
    catch {
        return "";
    }
}

function fixBuffer(options: RequestOptions & {formData?: Buffer | string;}, callback: (e: Error, h?: Record<string, any>, d?: Buffer | string) => void) {
    return (error: Error, res?: Record<string, any>, body?: Buffer | string) => {
        const ct = normalizeContentType((options as any)?.headers);
        const isText = !ct || ct.startsWith("text/") || ct.includes("json") || ct.includes("xml") || ct.includes("javascript");
        const out: any = isText ? toText(body) : toUint8Array(body);
        callback(error, res, out);
    };
}

export default function request(this: any, ...args: any[]) {
    const {url, options = {}, callback} = parseArguments.apply(this, args);

    if (!validUrl(url) || !validCallback(callback)) return null;

    if ("method" in options && methods.indexOf(options.method.toLowerCase()) >= 0) {
        // @ts-expect-error TODO: either fix or wiat for polyfill remove
        return Remote.https[options.method](url, options, fixBuffer(options, callback));
    }

    return Remote.https.request(url, options, fixBuffer(options, callback));
}

Object.assign(request, Object.fromEntries(
    methods.concat(Object.keys(aliases)).map(method => [method, function (this: any, ...args: any[]) {
        const {url, options = {}, callback} = parseArguments.apply(this, args);

        if (!validUrl(url) || !validCallback(callback)) return null;

        // @ts-expect-error TODO: either fix or wiat for polyfill remove
        return Remote.https[aliases[method] || method](url, options, fixBuffer(options, callback));
    }])
));
