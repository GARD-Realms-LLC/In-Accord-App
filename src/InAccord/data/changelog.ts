import config from "@stores/config";
import type {ChangelogProps} from "@ui/modals/changelog";

// fixed, improved, added, progress
export default {
    title: "InAccord",
    subtitle: `v${config.get("version")}`,
    // https://youtu.coom/ // fis this
    video: "https://www.youtube.com/", // fix this
    // banner: "https:// ", // fix this
    blurb: "Hotfix to squash some bugs.",
    changes: [
        {
            title: "Bugs Squashed",
            type: "fixed",
            items: [
                "Fixed styles breaking in certian areas.",
                "Fixed theme attributes from causing a bunch of lag."
            ]
        },
    ]
} as ChangelogProps;
