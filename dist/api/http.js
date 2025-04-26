"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
//@ts-nocheck
const express_1 = __importDefault(require("express"));
class HttpServer {
    constructor(id, port, origins, requests) {
        this.app = (0, express_1.default)();
        for (const req of requests) {
            const { url, requestType, method } = req;
            switch (requestType) {
                case "GET":
                    this.app.get("/api" + url, async (req, res) => await method(req, res));
                    break;
                case "POST":
                    this.app.post("/api" + url, async (req, res) => await method(req, res));
                    break;
                case "PUT":
                    this.app.put("/api" + url, async (req, res) => await method(req, res));
                    break;
                case "DELETE":
                    this.app.delete("/api" + url, async (req, res) => await method(req, res));
                    break;
                default:
                    console.error(`❌ Unsupported request type: ${requestType}`);
            }
        }
        this.app.use(express_1.default.static('../website'));
        this.app.listen(port, "0.0.0.0", () => {
            console.log(`✅ HTTP-Server '${id}' läuft auf Port ${port}`);
        });
    }
}
exports.HttpServer = HttpServer;
