export type NativeRequestMethod =
    | "GET"
    | "PUT"
    | "POST"
    | "DELETE"
    | "PATCH"
    | "OPTIONS"
    | "HEAD"
    | "CONNECT"
    | "TRACE";

export interface NativeRequestInit extends RequestInit {
    /** Request timeout in milliseconds. */
    timeout?: number;
    /** Maximum number of redirects to follow when redirect === "follow". */
    maxRedirects?: number;
    /** Whether to reject invalid TLS certificates (https only). Defaults to true. */
    rejectUnauthorized?: boolean;
}

export interface DriedAbortSignal {
    aborted(): boolean;
    reason(): unknown;
    /** Adds an abort listener; returns an unsubscribe function. */
    addListener(onAbort: () => void): () => void;
}

export interface NativeFetchRequest {
    url: string;

    method: NativeRequestMethod;
    headers: Record<string, string>;
    body: Uint8Array | string | null;

    keepalive?: boolean;
    redirect?: RequestRedirect;
    signal: DriedAbortSignal | null;

    timeout: number;
    maxRedirects: number;
    rejectUnauthorized: boolean;
}

export interface DriedResponse {
    url: string;
    redirected: boolean;

    status: number;
    statusText: string;
    headers: Record<string, string>;

    body: Uint8Array | null;
}
