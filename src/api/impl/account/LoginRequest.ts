import {twitchBot} from "../../../index";
import {requestError, requestSuccess} from "../requests";

export default {
    url: "/account/login",
    requestType: "GET",
    method: async (req:any, res:any) => {
        let {cacheCode} = req.query;
        try {
            let userData = await twitchBot.getUserFromCacheCode(cacheCode);
            if(userData === undefined) {
                res.status(requestError).json({});
                return;
            }
            res.status(requestSuccess).json(userData);
        } catch (ex){
            res.status(requestError).json({});
            console.error(ex);
        }
    }
}