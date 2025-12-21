import Modals from "@ui/modals";


export default {
    id: "support",
    name: "support",
    description: "Get help and support for InAccord",
    options: [],
    execute: async () => {
        Modals.showGuildJoinModal(""); //fix this.
    }
};