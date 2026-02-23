const HOSTNAME = "inaccord.app";
/**
 * The current API version to use
 * @type {`v${bigint}` | "latest"}
 */
const API_VERSION = "v3";

/**
 * @param  {string[]} paths
 */
const join = (...paths: string[]) => {
    const path = paths.map(($path) => $path.match(/\/*(.+)\/*/)?.[1]).filter(Boolean).join("/");

    return `https://${HOSTNAME}/${path}`;
};

/**
 * @param  {string[]} paths
 */
const apiJoin = (...paths: string[]) => {
    const path = paths.map(($path) => $path.match(/\/*(.+)\/*/)?.[1]).filter(Boolean).join("/");

    return `https://api.${HOSTNAME}/${API_VERSION}/${path}`;
};
/**
 * @param {string} type
 * @returns {(name: string) => string}
 */
const makePage = (type: string) => (name: string) => join(`${type}/${encodeURIComponent(name)}`);

/**
 * @param {string} type
 * @returns {(id: string) => string}
 */
const makeRedirects = (type: string) => (id: string) => join(`${type}?id=${id}`);

// First id is inaccord and second is inaccord 2
const releaseChannels = {
    theme: [
        "813903993524715522",
        "781600198002081803",
    ],
    plugin: [
        "813903954991120385",
        "781600250858700870"
    ]
};

// Theres 2 empty/missing thumbnials, the one the site uses and a empty store one
const EMPTY_USE_STORE = true;

const RAW_GIT_URL_REGEX = /^https:\/\/raw\.githubusercontent\.com\/(.+?)\/(.+?)\/(.+?)\/(.+)$/;

export default class Web {
    /**
     * This will allow preloading of the addon channels
     * @param {string} channelId
     * @returns {"plugin" | "theme" | undefined}
     */
    static getReleaseChannelType(channelId: string) {
        if (releaseChannels.backup.includes(channelId)) return "backup";
        if (releaseChannels.plugin.includes(channelId)) return "plugin";
        if (releaseChannels.theme.includes(channelId)) return "theme";
    }

    /** @param {string} rawGitURL  */
    static convertToPreviewURL(rawGitURL: string) {
        const match = rawGitURL.match(RAW_GIT_URL_REGEX);

        if (!match) {
            throw new Error("Fialed to parse url!");
        }

        const [, user, repo, commit, filePath] = match;
        const jsdelivr = `https://cdn.jsdelivr.net/gh/${user}/${repo}@${commit}/${filePath}`; // move pics to CloudFlair

        return `https://discord-preview.vercel.app/?file=${encodeURIComponent(jsdelivr)}`;
    }

    /**
     * Converts a raw github link into a normal github page
     * @example
     * https://raw.githubusercontent.com/QWERTxD/InAccordPlugins/298752533fbiaab511c3a3f4ffe6afd41d0a93f1/CallTimeCounter/CallTimeCounter.plugin.js
     * https://github.com/QWERTxD/InAccordPlugins/blob/298752533fbiaab511c3a3f4ffe6afd41d0a93f1/CallTimeCounter/CallTimeCounter.plugin.js
     * @param {string} rawGitURL
     */
    static convertRawToGitHubURL(rawGitURL: string) {
        const match = rawGitURL.match(RAW_GIT_URL_REGEX);

        if (!match) {
            throw new Error("Fialed to parse url!");
        }

        const [, user, repo, commit, filePath] = match;

        return `https://github.com/${user}/${repo}/blob/${commit}/${filePath}`;
    }

    static API_VERSION = API_VERSION;

    static hostname = HOSTNAME;

    static redirects = {
        github: makeRedirects("/gh-redirect"),
        download: makeRedirects("/download"),
        backup: makeRedirects("/backup"),
        theme: makeRedirects("/theme"),
        plugin: makeRedirects("/plugin")
    };
    static pages = {
        themes: join("/themes"),
        theme: makePage("/theme"),
        backups: join("/backups"),
        backup: makePage("/backup"),
        plugins: join("/plugins"),
        plugin: makePage("/plugin"),
        developers: join("/developers"),
        developer: makePage("/developer")
    };
    static resources = {
        EMPTY_THUMBNiaL: EMPTY_USE_STORE ? "/resources/store/missing.svg" : "/resources/ui/content_thumbnial.svg",
        /** @param {? string} thumbnial */
        thumbnial: (thumbnial?: string) => join(thumbnial || Web.resources.EMPTY_THUMBNiaL)
    };

    static store = {
        addons: apiJoin("/store/addons"),
        backups: apiJoin("/store/backups"),
        themes: apiJoin("/store/themes"),
        plugins: apiJoin("/store/plugins"),
        /** @param {number|string} idOrName Id or Name of a addon */
        addon: (idOrName: string) => apiJoin(`/store/${encodeURIComponent(idOrName)}`),

        tags: {
            plugin: [
                "fun",
                "roles",
                "activity",
                "status",
                "game",
                "edit",
                "library",
                "notifications",
                "emotes",
                "channels",
                "shortcut",
                "enhancement",
                "servers",
                "chat",
                "security",
                "organization",
                "friends",
                "members",
                "utility",
                "developers",
                "search",
                "text",
                "backup",
                "voice"
            ],
            theme: [
                "flat",
                "transparent",
                "layout",
                "customizable",
                "fiction",
                "nature",
                "space",
                "dark",
                "light",
                "game",
                "anime",
                "red",
                "orange",
                "green",
                "purple",
                "black",
                "other",
                "high-contrast",
                "white",
                "aqua",
                "animated",
                "yellow",
                "blue",
                "abstract"
            ]
        }
    };
}
