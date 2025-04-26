"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../index");
const requests_1 = require("../requests");
exports.default = {
    url: "/account/login",
    requestType: "GET",
    method: async (req, res) => {
        let { cacheCode } = req.query;
        try {
            let userData = await index_1.twitchBot.getUserFromCacheCode(cacheCode);
            if (userData === undefined) {
                res.status(requests_1.requestError).json({});
                return;
            }
            res.status(requests_1.requestSuccess).json(userData);
        }
        catch (ex) {
            res.status(requests_1.requestError).json({});
            console.error(ex);
        }
    }
};
