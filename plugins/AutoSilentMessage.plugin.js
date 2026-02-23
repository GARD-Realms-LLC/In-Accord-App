/**
 * @name AutoSilentMessage
 * @author glorytotheprc
 * @authorId 869418754348580885
 * @version 1.0.1
 * @description Make every message silent.
 */


const BD = new BdApi("AutoSilentMessage");
const { getByKeys } = BD.Webpack;

const MessageActions = getByKeys("sendMessage");

module.exports = class AutoSilentMessage {
    constructor(meta) {

    }

    start() {
        BD.Patcher.before(MessageActions, "sendMessage", (_, [, msg]) => {
            msg.content = '@silent ' + msg.content
        })
    }
    stop() {
        BD.Patcher.unpatchAll();
    }
};