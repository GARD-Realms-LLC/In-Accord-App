import React from "./react";

type AnyComponent = any;

type PatchCallback = (props: any, res: any, instance?: any) => any;

type PatchedFnEntry = {
    kind: "function";
    original: AnyComponent;
    wrapper: AnyComponent;
    callbacks: Set<PatchCallback>;
};

type PatchedClassEntry = {
    kind: "class";
    original: AnyComponent;
    originalRender: AnyComponent;
    callbacks: Set<PatchCallback>;
};

type PatchedEntry = PatchedFnEntry | PatchedClassEntry;

function isClassComponent(type: AnyComponent): boolean {
    try {
        return !!(type && type.prototype && (type.prototype.isReactComponent || typeof type.prototype.render === "function"));
    }
    catch {
        return false;
    }
}

function safeRunCallbacks(callbacks: Iterable<PatchCallback>, props: any, res: any, instance?: any) {
    let out = res;
    for (const cb of callbacks) {
        try {
            const next = cb(props, out, instance);
            if (typeof next !== "undefined") out = next;
        }
        catch {
            // Intentionally swallow: patch callbacks must not crash Discord.
        }
    }
    return out;
}

/**
 * Patches a React component "node" (an object with a `.type`) so we can intercept its render output.
 * This is used by the ContextMenu system to recursively inspect/modify rendered nodes.
 */
export default class NodePatcher {
    private entries = new WeakMap<AnyComponent, PatchedEntry>();

    patch(target: { type: AnyComponent }, callback: PatchCallback): () => void {
        if (!target || !target.type) return () => {};

        // If we were given our own wrapper, patch the original.
        const currentType = target.type as any;
        const original = currentType.__ia_nodepatcher_original || currentType;

        let entry = this.entries.get(original);

        if (!entry) {
            if (isClassComponent(original)) {
                const proto = original.prototype;
                const originalRender = proto && typeof proto.render === "function" ? proto.render : null;
                if (!originalRender) return () => {};

                const callbacks = new Set<PatchCallback>();

                const wrappedRender = function iaNodePatcherRender(this: any, ...args: any[]) {
                    const res = originalRender.apply(this, args);
                    return safeRunCallbacks(callbacks, this?.props, res, this);
                };

                // Preserve a few properties for debugging.
                (wrappedRender as any).__ia_nodepatcher_original_render = originalRender;

                proto.render = wrappedRender;

                entry = {
                    kind: "class",
                    original,
                    originalRender,
                    callbacks
                };

                this.entries.set(original, entry);
            }
            else {
                const callbacks = new Set<PatchCallback>();

                const wrapper = function iaNodePatcherWrapper(this: any, props: any) {
                    // Function components should not rely on `this`, but keep apply for safety.
                    const res = original.apply(this, [props]);
                    return safeRunCallbacks(callbacks, props, res, undefined);
                };

                // Copy React static fields that some components rely on.
                try {
                    Object.assign(wrapper, original);
                }
                catch {}

                try {
                    (wrapper as any).displayName = original.displayName || original.name || "iaNodePatched";
                }
                catch {}

                // Mark wrapper so we can find original later.
                (wrapper as any).__ia_nodepatcher_original = original;

                // Attempt to preserve forwardRef/memo wrappers if present.
                // If the original is a React forwardRef object, calling it directly will fail.
                // In those cases, we fall back to rendering it via React.createElement.
                const safeWrapper = function iaNodePatcherSafeWrapper(props: any) {
                    try {
                        // If it's callable, use wrapper; otherwise use createElement.
                        if (typeof original === "function") return (wrapper as any)(props);
                        return safeRunCallbacks(callbacks, props, React.createElement(original as any, props), undefined);
                    }
                    catch {
                        return safeRunCallbacks(callbacks, props, React.createElement(original as any, props), undefined);
                    }
                };

                try {
                    Object.assign(safeWrapper, wrapper);
                }
                catch {}

                (safeWrapper as any).__ia_nodepatcher_original = original;

                entry = {
                    kind: "function",
                    original,
                    wrapper: safeWrapper,
                    callbacks
                };

                this.entries.set(original, entry);
            }
        }

        // Register callback and ensure target.type points at the wrapper for function components.
        entry.callbacks.add(callback);
        if (entry.kind === "function") {
            target.type = entry.wrapper;
        }

        return () => {
            try {
                entry.callbacks.delete(callback);

                // If no callbacks remain, revert.
                if (entry.callbacks.size === 0) {
                    if (entry.kind === "function") {
                        // Only revert the specific target reference (we can't safely locate all).
                        if (target.type === entry.wrapper) target.type = entry.original;
                    }
                    else {
                        const proto = entry.original.prototype;
                        if (proto && proto.render === (proto.render as any)) {
                            proto.render = entry.originalRender;
                        }
                    }

                    this.entries.delete(entry.original);
                }
            }
            catch {
                // ignore
            }
        };
    }
}
