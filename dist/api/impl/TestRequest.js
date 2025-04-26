"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    url: "/test",
    requestType: "GET",
    method: async (req, res) => {
        return res.json({
            message: "CORS is working!",
            origin: req.headers.origin || "No origin"
        });
    }
};
