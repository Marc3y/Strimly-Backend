"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webSocketServer = exports.twitchBot = exports.httpApi = exports.dbAccounts = exports.database = void 0;
const http_1 = require("./http");
const requests_1 = __importDefault(require("./api/impl/requests"));
const mongo_1 = require("./data/mongo");
const twitch_1 = require("./twitch/twitch");
const websocket_1 = require("./ws/websocket");
exports.database = new mongo_1.Database("strimlyUser", "e5uTs46F0mTW8AZ8", "Strimly");
exports.dbAccounts = exports.database.mongoClient.db("Strimly").collection("accounts");
// @ts-ignore
exports.httpApi = new http_1.HttpServer("StrimlyApi", 4525, ["https://strimly.marcey.xyz", "https://strimly.marcey.xyz/", /\.marcey\.xyz$/], requests_1.default);
exports.twitchBot = new twitch_1.TwitchBot("012nyl7y9owvlzwadu2qljbg8qp0nr", "9n0dh88kt4xm246zx1ei3x2w5j4dz0", "790570730");
exports.webSocketServer = new websocket_1.SocketServer();
