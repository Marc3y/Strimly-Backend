import {requestError, requestSuccess, requestWrong} from "../../requests";
import {dbAccounts, twitchBot} from "../../../../index";
import {generateRandomString} from "../../../../utils/utils";

export default {
    url: "/twitch/reward/delete",
    requestType: "GET",
    method: async (req:any, res:any) => {
        let {cacheCode} = req.query;
        if(!cacheCode){
            res.status(requestError).json({error: "no cachecode given"});
            return;
        }
        let doc = await dbAccounts.findOne({cacheCode: cacheCode});
        if(!doc){
            res.status(requestError).json({error: "cacheCode not valid"});
            return;
        }
        await twitchBot.apiClient.channelPoints.deleteCustomReward(doc.userId, doc.ttsRewardId);
        await dbAccounts.updateOne({cacheCode: cacheCode}, {$set: {ttsRewardId: null}});
        res.status(requestSuccess).json({message: "success"});
    }
}