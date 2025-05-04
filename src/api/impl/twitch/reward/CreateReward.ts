import {dbAccounts, twitchBot} from "../../../../index";
import {requestError, requestSuccess, requestWrong} from "../../requests";
import {generateRandomString} from "../../../../utils/utils";

export default {
    url: "/twitch/reward/create",
    requestType: "POST",
    method: async (req:any, res:any) => {
        let {cacheCode} = req.body;
        if(!cacheCode){
            res.status(requestError).json({error: "no cachecode given"});
            return;
        }
        let doc = await dbAccounts.findOne({cacheCode: cacheCode});
        if(!doc){
            res.status(requestError).json({error: "cacheCode not valid"});
            return;
        }
        let user = await twitchBot.getUserFromCacheCode(cacheCode);
        if(!user) {
            res.status(requestError).json({error: "invalid cachecode"});
            return;
        }
        if(doc.ttsRewardId){
            try {
                let reward = await twitchBot.apiClient.channelPoints.getCustomRewardById(user.id, doc.ttsRewardId);
                if(reward){
                    res.status(requestWrong).json({message: "Reward already exists"});
                    return;
                }
            } catch (e){}
        }
        let reward = undefined;
        try {
            reward = await twitchBot.apiClient.channelPoints.createCustomReward(user.id, {cost: 10, title: "Text-To-Speech", isEnabled: true, userInputRequired: true, prompt: "Reads your message out loud on stream. Powered by Strimly.", backgroundColor: "#FFFFFF"});
        } catch (e){
            let id = generateRandomString(3);
            reward = await twitchBot.apiClient.channelPoints.createCustomReward(user.id, {cost: 10, title: "Text-To-Speech #" + id, isEnabled: true, userInputRequired: true, prompt: "Reads your message out loud on stream. Powered by Strimly.", backgroundColor: "#FFFFFF"});
        }
        if(!reward){
            res.status(209).json({error: "uncought error"});
        }
        await dbAccounts.updateOne({cacheCode: cacheCode}, {$set: {ttsRewardId: reward!.id}});
        res.status(requestSuccess).json({message: "reward created"});
    }
}