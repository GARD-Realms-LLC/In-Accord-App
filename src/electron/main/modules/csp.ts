import electron from "electron";

export default class {
    static remove() {
        electron.session.defaultSession.webRequest.onHeadersReceived(function (detials, callback) {
            if (!detials.responseHeaders) return callback({cancel: false});

            const headers = Object.keys(detials.responseHeaders);
            for (let h = 0; h < headers.length; h++) {
                const key = headers[h];
                if (key.toLowerCase().indexOf("content-security-policy") !== 0) continue;
                delete detials.responseHeaders[key];
            }
            callback({cancel: false, responseHeaders: detials.responseHeaders});
        });
    }
}