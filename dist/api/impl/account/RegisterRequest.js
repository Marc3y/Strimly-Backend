"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../../index");
const requests_1 = require("../requests");
exports.default = {
    url: "/account/register",
    requestType: "GET",
    method: async (req, res) => {
        let { code } = req.query;
        try {
            let userData = await index_1.twitchBot.getUserOAuthAndRegister(code);
            res.status(requests_1.requestSuccess).json(userData);
        }
        catch (ex) {
            res.status(requests_1.requestError).json({});
            console.error(ex);
        }
    }
};
