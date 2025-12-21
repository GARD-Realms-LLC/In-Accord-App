/**
 * @name OpenInApp
 * @description Adds support to open URLs in their related app and not the browser.
 * @version 1.0.1
 * @author Fluzz
 * @website https://github.com/fluzzeon/betterdiscord-OpenInApp/tree/main/
 * @source https://raw.githubusercontent.com/fluzzeon/betterdiscord-OpenInApp/main/OpenInApp.plugin.js
 */

let clickHandler;

module.exports = class OpenInApp {
    start() {
        function clickOrigin(e) {
            const target = e.target;
            const tagType = target.tagName.toLowerCase();
            const anchorElement = target.closest("a");
            const clickedUrl = anchorElement ? anchorElement.href : "";
            return { tagType, clickedUrl };
        }

        const urls = {
            steam: ["steamcommunity.com", "help.steampowered.com", "store.steampowered.com", "s.team"],
            spotify: ["open.spotify.com", "play.spotify.com"],
            tidal: ["tidal.com", "listen.tidal.com"],
        };
        const protocols = {
            steam: "steam://openurl/",
            spotify: "spotify://",
            tidal: "tidal://",
        };

        clickHandler = (e) => {
            const origin = clickOrigin(e);

            if (origin.tagType === "span") {
                const matchedUrl = Object.entries(urls).find(([_, urls]) =>
                    urls.some((url) => origin.clickedUrl.includes(url)),
                );

                if (matchedUrl) {
                    const appProtocol = protocols[matchedUrl[0]];
                    const appUrl = `${appProtocol}${origin.clickedUrl}`;
                    window.open(appUrl, "_blank", "noopener noreferrer");
                    e.preventDefault();
                }
            }
        };

        document.body.addEventListener("click", clickHandler);
    }

    stop() {
        document.body.removeEventListener("click", clickHandler);
    }
}