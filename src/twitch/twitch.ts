import {AccessToken, exchangeCode, RefreshingAuthProvider, StaticAuthProvider} from "@twurple/auth";
import {database, dbAccounts} from "../index";
import {ApiClient} from "@twurple/api";
import { v4 as uuid } from 'uuid';


export class TwitchBot {
    botId:string // = "1301395250"
    authProvider:RefreshingAuthProvider
    apiClient:ApiClient
    clientId:string

    /*cacheCode, userId*/
    private cacheCodes:Map<string, string> = new Map<string, string>();
    /*userId, overlayId*/
    private overlayIds:Map<string, string> = new Map<string, string>();

    private clientSecret:string
    private botAccessToken:string = "";
    private botRefreshToken:string = "";

    constructor(clientId:string, clientSecret:string, botId:string) {
        this.botId = botId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.authProvider = new RefreshingAuthProvider({
            clientId,
            clientSecret
        });
        this.apiClient = new ApiClient({authProvider: this.authProvider});
        this.init();
    }

    async init(): Promise<void> {
        let document = await dbAccounts.findOne({userId: this.botId});

        this.authProvider.onRefresh((userId, tokenData) => {
            if(userId === this.botId){
                this.botAccessToken = tokenData.accessToken;
            }
            try {
                dbAccounts.updateOne({refreshToken: tokenData.refreshToken}, { $set: {
                        accessToken: tokenData.accessToken
                    }});
            } catch (ex){}
        });

        //Add users
        let userDocs = await dbAccounts.find({}).toArray();
        userDocs.forEach((doc) => {
            this.cacheCodes.set(doc.cacheCode, doc.userId);
            this.overlayIds.set(doc.userId, doc.overlayId);
            this.authProvider.addUser(doc.userId, {
                accessToken: doc.accessToken,
                refreshToken: doc.refreshToken,
                expiresIn: 0,
                obtainmentTimestamp: 0
            });
        });
    }

    private async registerUser(tokenData:AccessToken){
        let response = await fetch("https://api.twitch.tv/helix/users", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.accessToken}`,
                "Client-Id": this.clientId,
            }
        });
        if(!response.ok){
            return undefined;
        }
        let data = await response.json();
        await this.authProvider.addUserForToken(tokenData);
        let doc = await dbAccounts.findOne({userId: data.data[0].id});
        if(doc){
            await dbAccounts.updateOne({userId: data.data[0].id}, {$set: {accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken}});
            this.cacheCodes.set(doc.cacheCode, data.data[0].id);
            return {id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, cacheCode: doc.cacheCode};
        } else {
            let cacheCode = uuid();
            let overlayId = uuid();
            this.cacheCodes.set(cacheCode, data.data[0].id);
            this.overlayIds.set(data.data[0].id, overlayId);
            await dbAccounts.insertOne({userId: data.data[0].id, accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, cacheCode: cacheCode, overlayId: overlayId});
            return {id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, type: data.data[0].type, description: data.data[0].description, offlinePlaceholderUrl: data.data[0].offline_image_url, name: data.data[0].name, cacheCode: cacheCode, overlayId: overlayId};
        }
    }

    async getUserOAuthAndRegister(code:string):Promise<any> {
        const tokenData = await exchangeCode(this.clientId, this.clientSecret, code, 'http://localhost');
        let userData = await this.registerUser(tokenData);
        return userData;
    }

    async getUserFromCacheCode(cacheCode:string){
        if(!this.cacheCodes.has(cacheCode)) return undefined;
        let userId = this.cacheCodes.get(cacheCode);
        let overlayId = this.overlayIds.get(userId!);
        let user = await this.apiClient.users.getUserById(userId!);
        if(!user) return undefined;
        return {broadcasterType: user.broadcasterType, creationDate: user.creationDate, description: user.description, displayName: user.displayName, id: user.id, name: user.name, offlinePlaceholderUrl: user.offlinePlaceholderUrl, profilePictureUrl: user.profilePictureUrl, type: user.type, overlayId: overlayId};
    }
}