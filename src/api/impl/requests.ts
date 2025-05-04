import TestRequest from "./TestRequest";
import RegisterRequest from "./account/RegisterRequest";
import LoginRequest from "./account/LoginRequest";
import UpdateTTSData from "./tts/UpdateTTSData";
import GetTTSData from "./tts/GetTTSData";
import CreateReward from "./twitch/reward/CreateReward";
import DeleteReward from "./twitch/reward/DeleteReward";

export default [TestRequest, RegisterRequest, LoginRequest, UpdateTTSData, GetTTSData, CreateReward, DeleteReward];

export const requestSuccess = 201;
export const requestWrong = 203;
export const requestError = 301;

/*

export default {
    url: "/test",
    requestType: "GET",
    method: async (req:any, res:any) => {
        res.status(201).json({text: "Kleiner Testi"});
    }
}


 */
