const path = require("path");
const fs = require("fs");

/**
 * electron-builder hook: afterPack
 * @param {import('electron-builder').AfterPackContext} context
 */
module.exports = async function afterPack(context) {
    // Intentionally no-op.
    // Icon embedding is handled in afterAllArtifactBuild, because the EXE can be
    // held open during pack/unpack and rcedit can't commit changes in afterPack.
    void context;
};
