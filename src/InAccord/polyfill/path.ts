import Remote from "./remote";

// Path access is provided by the preload API (Node-backed) and exposed through Remote.
// This module exists so renderer code never imports Node's built-in `path`.

export default (Remote as any)?.path;
