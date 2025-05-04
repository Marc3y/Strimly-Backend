import {requestError, requestSuccess} from "../requests";
import {dbAccounts, twitchBot} from "../../../index";

export default {
    url: "/tts/update",
    requestType: "POST",
    method: async (req:any, res:any) => {
        const {cacheCode, ttsCmdEnabled, ttsCmdRoles, ttsCmdCooldown, ttsCmdAlias, ttsRewardEnabled, ttsRewardRoles, ttsRewardId} = req.body;
        if(!cacheCode){
            res.status(requestError).json({error: "cacheCode not found"});
            return;
        }
        await dbAccounts.updateOne({cacheCode: cacheCode}, {
            $set: {
                ttsCmdEnabled,
                ttsCmdRoles,
                ttsCmdCooldown,
                ttsCmdAlias,
                ttsRewardEnabled,
                ttsRewardRoles
            }
        });
        twitchBot.updateTTSDataCache(cacheCode, {
            ttsCmdEnabled: ttsCmdEnabled,
            ttsCmdRoles: ttsCmdRoles,
            ttsCmdCooldown: ttsCmdCooldown,
            ttsCmdAlias: ttsCmdAlias,
            ttsRewardEnabled: ttsRewardEnabled,
            ttsRewardRoles: ttsRewardRoles,
            ttsRewardId: ttsRewardId
        });
        res.status(requestSuccess).json({success: true});
    }
}