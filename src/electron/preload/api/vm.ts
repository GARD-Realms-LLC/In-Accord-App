export function compileFunction(code: string, params: string[] = [], options = {}) {
    try {
        // NOTE: Node's `vm` module is unsafe/unsupported in Electron renderer processes
        // (including many preload contexts) on newer Discord/Electron builds.
        // Use `new Function` as a lightweight compile step.
        // `options` is accepted for API compatibility but intentionally ignored here.
        void options;
        // eslint-disable-next-line no-new-func
        return new Function(...params, code);
    }
    catch (e) {
        const error: Error = e as Error;
        return {
            name: error.name,
            message: error.message,
            stack: error.stack
        };
    }
}