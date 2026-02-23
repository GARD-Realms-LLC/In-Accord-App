import * as https from "https";
import * as http from "http";

import type {DriedResponse, NativeFetchRequest} from "@common/native-fetch.ts";

const redirectCodes = new Set([301, 302, 307, 308]);

function normalizeHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers || {})) {
        if (typeof v === "string") out[k] = v;
        else if (Array.isArray(v)) out[k] = v.join(", ");
        else if (typeof v === "number") out[k] = String(v);
    }
    return out;
}

export async function nativeFetch(request: NativeFetchRequest): Promise<DriedResponse> {
    const requestedUrl = String(request?.url || "");
    const initial = new URL(requestedUrl);
    if (initial.protocol !== "http:" && initial.protocol !== "https:") {
        throw new Error(`Unsupported protocol: ${initial.protocol}`);
    }

    const maxRedirects = Number.isFinite(request.maxRedirects) ? request.maxRedirects : 20;
    const timeout = Number.isFinite(request.timeout) ? request.timeout : 3000;
    const redirectMode = request.redirect ?? "follow";
    const rejectUnauthorized = request.rejectUnauthorized !== false;

    const doRequest = (url: URL, redirectCount: number): Promise<DriedResponse> => {
        return new Promise((resolve, reject) => {
            const Module = url.protocol === "http:" ? http : https;

            const opts: https.RequestOptions = {
                method: request.method || "GET",
                headers: request.headers || {},
                timeout,
                rejectUnauthorized: url.protocol === "https:" ? rejectUnauthorized : undefined
            };

            const req = Module.request(url.href, opts, (res) => {
                const status = res.statusCode ?? 0;
                const statusText = res.statusMessage ?? "";

                // Redirect handling
                if (redirectCodes.has(status) && res.headers.location && redirectMode !== "manual") {
                    const nextCount = redirectCount + 1;
                    if (nextCount > maxRedirects) {
                        reject(new Error(`Maximum amount of redirects reached (${maxRedirects})`));
                        try { req.destroy(); } catch {}
                        return;
                    }

                    let nextUrl: URL;
                    try {
                        nextUrl = new URL(res.headers.location, url);
                    }
                    catch (e) {
                        reject(e as Error);
                        try { req.destroy(); } catch {}
                        return;
                    }

                    // Drain data so sockets can be reused.
                    try { res.resume(); } catch {}

                    doRequest(nextUrl, nextCount).then(resolve, reject);
                    return;
                }

                const chunks: Buffer[] = [];
                res.on("data", (chunk: Buffer) => chunks.push(chunk));
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

            // Abort support
            let removeAbort: null | (() => void) = null;
            try {
                if (request.signal) {
                    removeAbort = request.signal.addListener(() => {
                        try { req.destroy(new Error("Request aborted")); } catch {}
                    });
                }
            }
            catch {
                // ignore
            }

            try {
                const body = request.body;
                if (body) {
                    req.write(body as any);
                }
            }
            catch (e) {
                try { removeAbort?.(); } catch {}
                reject(e as Error);
                try { req.destroy(); } catch {}
                return;
            }
            finally {
                req.end();
            }

            req.once("close", () => {
                try { removeAbort?.(); } catch {}
            });
        });
    };

    return doRequest(initial, 0);
}
