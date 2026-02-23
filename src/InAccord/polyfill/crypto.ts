import Remote from "./remote";


export default {
    ...Remote.crypto,
    // Never depend on the global Buffer (Discord can strip it).
    randomBytes(length: number) {
        const b: any = Remote.crypto.randomBytes(length);
        // Node returns a Buffer (Uint8Array subclass). In browser-only contexts,
        // it may already be a Uint8Array. Always return a Uint8Array.
        try {
            return b instanceof Uint8Array ? b : new Uint8Array(b);
        }
        catch {
            return new Uint8Array();
        }
    }
};