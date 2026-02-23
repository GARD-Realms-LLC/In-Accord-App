import {OptionTypes} from "@modules/commandmanager";
import ipc from "@modules/ipc";


export default {
    id: "restart",
    name: "restart",
    description: "Restart Discord with or without InAccord",
    options: [
        {
            type: OptionTypes.BOOLEAN,
            name: "vanilla",
            description: "Should Discord be relaunched without InAccord?",
            required: true,
        },
    ],
    execute: async (data) => {
        const vanilla = data.find(o => o.name === "vanilla").value;
        ipc.relaunch(vanilla ? ["--vanilla"] : []);
    }
};