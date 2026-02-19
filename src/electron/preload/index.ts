import init from "./init";
import fs from "fs";
import path from "path";
import { contextBridge } from "electron";
// Import the preload API and expose it as window.InAccordPreload so the renderer
// bundle can call window.InAccordPreload() when it executes inside preload.
import * as PreloadAPI from "./api/index";
// Expose a stable callable InAccordPreload into the renderer global as early as
// possible. Use contextBridge.exposeInMainWorld when available (recommended)
// so the function is visible inside context-isolated renderer worlds. Fall
// back to assigning to window/globalThis where appropriate.
try {
	if (contextBridge && typeof (contextBridge as any).exposeInMainWorld === 'function') {
		(contextBridge as any).exposeInMainWorld('InAccordPreload', () => PreloadAPI);
	} else {
		(globalThis as any).InAccordPreload = () => PreloadAPI;
		try { (window as any).InAccordPreload = (globalThis as any).InAccordPreload; } catch {}
	}
} catch {
	// best-effort exposure, continue regardless
	try { (globalThis as any).InAccordPreload = () => PreloadAPI; } catch {}
}
try {
	// Log the shape/type so we can see if something else overwrote it
	const _tlog = path.join(__dirname, "preload_runtime.log");
	try { fs.appendFileSync(_tlog, `[${new Date().toISOString()}] EXPOSED_InAccordPreload_type=${typeof (globalThis as any).InAccordPreload}\n`); } catch {}
} catch {}

// Diagnostic preload: log execution and attempt to require/eval the renderer bundle
// to help capture failures when injecting the renderer bundle at runtime.
try {
	const logFile = path.join(__dirname, "preload_runtime.log");
	const now = () => new Date().toISOString();
	const log = (m: string) => {
		try { fs.appendFileSync(logFile, `[${now()}] ${m}\n`); } catch {}
	};

	log(`PRELOAD_INDEX_START __dirname=${__dirname} pid=${process.pid}`);

	const bundlePath = path.join(__dirname, "..", "..", "dist", "InAccord.js");
	// When used via DISCORD_PRELOAD the preload file is usually the dist/preload.js
	// so also check local sibling location.
	const altBundle = path.join(__dirname, "..", "..", "dist", "InAccord.js");
	const siblingBundle = path.join(__dirname, "..", "..", "dist", "InAccord.js");
	const candidates = [bundlePath, altBundle, siblingBundle, path.join(__dirname, "InAccord.js")];

	let found: string | null = null;
	for (const c of candidates) {
		try { if (fs.existsSync(c)) { found = c; break; } } catch {}
	}

	if (!found) {
		log('BUNDLE_NOT_FOUND candidates=' + JSON.stringify(candidates));
	} else {
		try { log('BUNDLE_FOUND=' + found + ' size=' + fs.statSync(found).size); } catch (e) { log('STAT_ERROR ' + String(e)); }
		try {
			// Do NOT execute the renderer bundle synchronously here — it expects the
			// renderer environment (window.webpackChunkdiscord_app) to exist. Instead,
			// defer execution until the page's webpack chunk array is available.
			log('DEFERRED_INJECT_SETUP for ' + found);
			const tryInject = () => {
				try {
					// Check for the webpack chunk array used by Discord's renderer
					// bundler. When present, it's safe to eval the renderer bundle.
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const win: any = globalThis;
					if (win && win.webpackChunkdiscord_app && typeof win.webpackChunkdiscord_app.push === 'function') {
						log('DEFERRED_INJECT_TRIGGERED');
						try {
							const code = fs.readFileSync(found, 'utf8');
							log('READ_SUCCESS length=' + code.length);
							try {
								// Evaluate inside the renderer/global context
								// eslint-disable-next-line no-eval
								(0, eval)(code);
								log('DEFERRED_EVAL_SUCCESS');
							} catch (evalErr) {
								log('DEFERRED_EVAL_ERROR ' + (evalErr && evalErr.stack ? evalErr.stack : String(evalErr)));
								try { fs.writeFileSync(path.join(__dirname, 'preload_bundle_copy.js'), code); log('WROTE_BUNDLE_COPY'); } catch (we) { log('WRITE_COPY_ERROR ' + String(we)); }
							}
						} catch (readErr) { log('READ_ERROR ' + (readErr && readErr.stack ? readErr.stack : String(readErr))); }
						return;
					}
				} catch (checkErr) {
					log('DEFERRED_CHECK_ERROR ' + String(checkErr));
				}
				setTimeout(tryInject, 200);
			};
			setTimeout(tryInject, 0);
			// Also listen for the property being created or DOMContentLoaded so we
			// can trigger injection immediately when the renderer environment is ready.
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const win: any = globalThis;
				if (!win.webpackChunkdiscord_app) {
					Object.defineProperty(win, "webpackChunkdiscord_app", {
						configurable: true,
						set(value) {
							Object.defineProperty(win, "webpackChunkdiscord_app", { value, writable: true, configurable: true });
							tryInject();
						},
						get() {
							return undefined;
						}
					});
				}
				if (typeof (win.addEventListener) === 'function') {
					win.addEventListener('DOMContentLoaded', tryInject, { once: true });
				}
			} catch (listenerErr) {
				log('DEFERRED_LISTENER_ERROR ' + String(listenerErr));
			}
			log('DEFERRED_INJECT_SCHEDULED');
		} catch (deferErr) {
			log('DEFER_SETUP_ERROR ' + (deferErr && deferErr.stack ? deferErr.stack : String(deferErr)));
		}
	}

	log('PRELOAD_INDEX_END');
}
catch (e) {
	try { fs.appendFileSync(path.join(__dirname, "preload_runtime.log"), `[${new Date().toISOString()}] PRELOAD_INDEX_FATAL ${String(e)}\n`); } catch {}
}

// Preserve existing behavior (init will mark preload_loaded.log and run original preload)
try { init(); } catch {}
