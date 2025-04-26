import {twitchBot} from "../../../index";
import {requestError, requestSuccess} from "../requests";

export default {
    url: "/account/register",
    requestType: "GET",
    method: async (req:any, res:any) => {
        let {code} = req.query;
        try {
            let userData = await twitchBot.getUserOAuthAndRegister(code);
            res.status(requestSuccess).json(userData);
        } catch (ex){
            res.status(requestError).json({});
            console.error(ex);
        }
    }
}