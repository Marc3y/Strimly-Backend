import {requestError, requestSuccess} from "../requests";
import {dbAccounts} from "../../../index";

export default {
    url: "/tts/get",
    requestType: "GET",
    method: async (req:any, res:any) => {
        const {cacheCode} = req.query;
        if(!cacheCode){
            res.status(requestError).json({error: "cacheCode not found"});
            return;
        }
        let doc = await dbAccounts.findOne({cacheCode: cacheCode});
        if(!doc){
            res.status(requestError).json({error: "cacheCode not valid"});
            return;
        }
        res.status(requestSuccess).json({ttsCmdEnabled: doc.ttsCmdEnabled, ttsCmdRoles: doc.ttsCmdRoles, ttsCmdCooldown: doc.ttsCmdCooldown, ttsCmdAlias: doc.ttsCmdAlias, ttsRewardEnabled: doc.ttsRewardEnabled, ttsRewardRoles: doc.ttsRewardRoles, ttsRewardId: doc.ttsRewardId});
        return;
    }
}