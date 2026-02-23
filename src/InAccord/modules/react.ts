import DiscordModules from "./discordmodules";

// Discord Canary can load before React is available through our module lookup.
// Never destructure React at import-time.

type AnyFn = (...args: any[]) => any;

const fallbackChildren = {
    map: () => null,
    forEach: () => null,
    count: () => 0,
    only: (c: any) => c,
    toArray: (c: any) => (Array.isArray(c) ? c : (c == null ? [] : [c]))
};

class FallbackComponent {}

const fallbackReact: any = {
    Children: fallbackChildren,
    Component: FallbackComponent,
    Fragment: "__IA_REACT_FRAGMENT__",
    createElement: () => null,
    cloneElement: (el: any) => el,
    createContext: () => ({ Provider: () => null, Consumer: () => null }),
    createRef: () => ({ current: null }),
    forwardRef: (fn: AnyFn) => fn,
    lazy: (fn: AnyFn) => fn,
    memo: (c: any) => c,
    startTransition: (fn: AnyFn) => fn(),
    useCallback: (fn: AnyFn) => fn,
    useContext: () => null,
    useDebugValue: () => void 0,
    useDeferredValue: (v: any) => v,
    useEffect: () => void 0,
    useId: () => "",
    useImperativeHandle: () => void 0,
    useInsertionEffect: () => void 0,
    useLayoutEffect: () => void 0,
    useMemo: (fn: AnyFn) => fn(),
    useReducer: () => [null, () => void 0],
    useRef: (v: any) => ({ current: v }),
    useState: (v: any) => [typeof v === "function" ? v() : v, () => void 0],
    useSyncExternalStore: () => null,
    useTransition: () => [false, (fn: AnyFn) => fn()]
};

let React: any = fallbackReact;
let ReactDOM: any = {};

// Live bindings (important: many modules import these at runtime).
export { React as default, ReactDOM };

export let Children: any = fallbackReact.Children;
export let Component: any = fallbackReact.Component;
export let Fragment: any = fallbackReact.Fragment;
export let cloneElement: any = fallbackReact.cloneElement;
export let createContext: any = fallbackReact.createContext;
export let createElement: any = fallbackReact.createElement;
export let createRef: any = fallbackReact.createRef;
export let forwardRef: any = fallbackReact.forwardRef;
export let lazy: any = fallbackReact.lazy;
export let memo: any = fallbackReact.memo;
export let startTransition: any = fallbackReact.startTransition;
export let useCallback: any = fallbackReact.useCallback;
export let useContext: any = fallbackReact.useContext;
export let useDebugValue: any = fallbackReact.useDebugValue;
export let useDeferredValue: any = fallbackReact.useDeferredValue;
export let useEffect: any = fallbackReact.useEffect;
export let useId: any = fallbackReact.useId;
export let useImperativeHandle: any = fallbackReact.useImperativeHandle;
export let useInsertionEffect: any = fallbackReact.useInsertionEffect;
export let useLayoutEffect: any = fallbackReact.useLayoutEffect;
export let useMemo: any = fallbackReact.useMemo;
export let useReducer: any = fallbackReact.useReducer;
export let useRef: any = fallbackReact.useRef;
export let useState: any = fallbackReact.useState;
export let useSyncExternalStore: any = fallbackReact.useSyncExternalStore;
export let useTransition: any = fallbackReact.useTransition;

function refreshReactOnce() {
    try {
        const r = (DiscordModules as any).React;
        if (r) {
            React = r;

            Children = r.Children;
            Component = r.Component;
            Fragment = r.Fragment;
            cloneElement = r.cloneElement;
            createContext = r.createContext;
            createElement = r.createElement;
            createRef = r.createRef;
            forwardRef = r.forwardRef;
            lazy = r.lazy;
            memo = r.memo;
            startTransition = r.startTransition;
            useCallback = r.useCallback;
            useContext = r.useContext;
            useDebugValue = r.useDebugValue;
            useDeferredValue = r.useDeferredValue;
            useEffect = r.useEffect;
            useId = r.useId;
            useImperativeHandle = r.useImperativeHandle;
            useInsertionEffect = r.useInsertionEffect;
            useLayoutEffect = r.useLayoutEffect;
            useMemo = r.useMemo;
            useReducer = r.useReducer;
            useRef = r.useRef;
            useState = r.useState;
            useSyncExternalStore = r.useSyncExternalStore;
            useTransition = r.useTransition;
        }

        const rd = (DiscordModules as any).ReactDOM;
        if (rd) {
            ReactDOM = rd;
        }

        return Boolean((DiscordModules as any).React);
    }
    catch {
        return false;
    }
}

// Keep trying briefly; stops automatically after React is found.
try {
    if (!refreshReactOnce()) {
        const iv = setInterval(() => {
            try {
                if (refreshReactOnce()) clearInterval(iv);
            }
            catch {}
        }, 50);
    }
}
catch {}
