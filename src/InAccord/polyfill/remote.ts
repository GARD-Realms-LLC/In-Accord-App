/** @type {import("../../electron/preload/api/index") | null} */
let RemoteAPI: any = null;

try {
	const fn: any = (window as any).InAccordPreload;
	if (typeof fn === "function") {
		RemoteAPI = fn();
	}
}
catch {
	RemoteAPI = null;
}

export default RemoteAPI;