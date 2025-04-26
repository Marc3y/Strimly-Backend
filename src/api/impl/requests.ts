import TestRequest from "./TestRequest";
import RegisterRequest from "./account/RegisterRequest";
import LoginRequest from "./account/LoginRequest";

export default [TestRequest, RegisterRequest, LoginRequest];

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
