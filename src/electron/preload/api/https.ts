import * as fs from "fs";
import * as https from "https";
import * as http from "http";
import {Buffer as NodeBuffer} from "buffer";


const methods = ["get", "put", "post", "delete", "head"];
const redirectCodes = new Set([301, 302, 307, 308]);
const dataToClone: Array<keyof http.IncomingMessage> = ["statusCode", "statusMessage", "url", "headers", "method", "aborted", "complete", "rawHeaders"];

type RequestOptions = https.RequestOptions & {formData?: Buffer | string;};
type RequestCallback = (e: Error, h?: Record<string, any>, d?: Buffer | string) => void;
type SetReq = (res: http.IncomingMessage, req: http.ClientRequest) => void;

function safeBufferConcat(chunks: any[]): Buffer {
    // Some Discord/Electron preload environments strip the global Buffer.
    // Never depend on it being present.
    const Buf: any = (globalThis as any).Buffer || NodeBuffer;
    try {
        if (Buf && typeof Buf.concat === "function") {
            const list = (chunks || []).map((c) => {
                try {
                    if (Buf.isBuffer && Buf.isBuffer(c)) return c;
                    return Buf.from(c);
                }
                catch {
                    return Buf.from(String(c ?? ""));
                }
            });
            return Buf.concat(list);
        }
    }
    catch {}

    // Last resort: manual concat of Uint8Array-ish chunks.
    try {
        const parts: Uint8Array[] = (chunks || []).map((c) => {
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
        return NodeBuffer.from(out);
    }
    catch {
        return NodeBuffer.from([]);
    }
}

const makeRequest = (url: string, options: RequestOptions, callback: RequestCallback, setReq: SetReq) => {
    const req = https.request(url, Object.assign({method: "GET"}, options), res => {
        if (redirectCodes.has(res.statusCode ?? 0) && res.headers.location) {
            const final = new URL(res.headers.location);

            for (const [key, value] of new URL(url).searchParams.entries()) {
                final.searchParams.set(key, value);
            }

            return makeRequest(final.toString(), options, callback, setReq);
        }

        const chunks: Buffer[] = [];
        let error: Error | null = null;

        setReq(res, req);

        res.addListener("error", err => {error = err;});

        res.addListener("data", chunk => {
            chunks.push(chunk);
        });

        res.addListener("end", () => {
            const data = Object.fromEntries(dataToClone.map(h => [h, res[h]]));

            callback(error as Error, data, safeBufferConcat(chunks));
            req.end();
        });
    });

    if (options.formData) {
        // Make sure to close the socket.
        try {req.write(options.formData);}
        finally {req.end();}
    }
    else {
        req.end();
    }

    req.on("error", (error) => callback(error));
};

const request = function (url: string, options: RequestOptions, callback: RequestCallback) {
    let responseObject: http.IncomingMessage | null = null;
    let reqObject: http.ClientRequest | null = null;
    let pipe: NodeJS.WritableStream | null = null;

    makeRequest(url, options, callback, (res, req) => {
        reqObject = req;
        responseObject = res;

        if (pipe) {
            res.pipe(pipe);
        }
    });

    return {
        end() {reqObject?.end();},
        pipe(fsStream: fs.WriteStream) {
            if (!responseObject) {
                pipe = fsStream;
            }
            else {
                responseObject.pipe(fsStream);
            }
        }
    };
};

export default Object.assign({request},
    Object.fromEntries(methods.map(method => [
        method,
        function (this: typeof https["get"], ...args: any[]) {
            args[1] ??= {};

            args[1].method ??= method.toUpperCase();

            return Reflect.apply(request, this, args);
        }
    ]))
);
