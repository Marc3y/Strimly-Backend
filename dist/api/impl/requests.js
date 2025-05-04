"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestError = exports.requestWrong = exports.requestSuccess = void 0;
const TestRequest_1 = __importDefault(require("./TestRequest"));
const RegisterRequest_1 = __importDefault(require("./account/RegisterRequest"));
const LoginRequest_1 = __importDefault(require("./account/LoginRequest"));
const UpdateTTSData_1 = __importDefault(require("./tts/UpdateTTSData"));
const GetTTSData_1 = __importDefault(require("./tts/GetTTSData"));
const CreateReward_1 = __importDefault(require("./twitch/reward/CreateReward"));
const DeleteReward_1 = __importDefault(require("./twitch/reward/DeleteReward"));
exports.default = [TestRequest_1.default, RegisterRequest_1.default, LoginRequest_1.default, UpdateTTSData_1.default, GetTTSData_1.default, CreateReward_1.default, DeleteReward_1.default];
exports.requestSuccess = 201;
exports.requestWrong = 203;
exports.requestError = 301;
/*

export default {
    url: "/test",
    requestType: "GET",
    method: async (req:any, res:any) => {
        res.status(201).json({text: "Kleiner Testi"});
    }
}


 */
