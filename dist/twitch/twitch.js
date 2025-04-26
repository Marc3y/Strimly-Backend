"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchBot = void 0;
const auth_1 = require("@twurple/auth");
const index_1 = require("../index");
const api_1 = require("@twurple/api");
const uuid_1 = require("uuid");
class TwitchBot {
    constructor(clientId, clientSecret, botId) {
        /*cacheCode, userId*/
        this.cacheCodes = new Map();
        /*userId, overlayId*/
        this.overlayIds = new Map();
        this.botAccessToken = "";
        this.botRefreshToken = "";
        this.botId = botId;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
        this.authProvider = new auth_1.RefreshingAuthProvider({
            clientId,
            clientSecret
        });
        this.apiClient = new api_1.ApiClient({ authProvider: this.authProvider });
        this.init();
    }
    async init() {
        let document = await index_1.dbAccounts.findOne({ userId: this.botId });
        this.authProvider.onRefresh((userId, tokenData) => {
            if (userId === this.botId) {
                this.botAccessToken = tokenData.accessToken;
            }
            try {
                index_1.dbAccounts.updateOne({ refreshToken: tokenData.refreshToken }, { $set: {
                        accessToken: tokenData.accessToken
                    } });
            }
            catch (ex) { }
        });
        //Add users
        let userDocs = await index_1.dbAccounts.find({}).toArray();
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
    async registerUser(tokenData) {
        let response = await fetch("https://api.twitch.tv/helix/users", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${tokenData.accessToken}`,
                "Client-Id": this.clientId,
            }
        });
        if (!response.ok) {
            return undefined;
        }
        let data = await response.json();
        await this.authProvider.addUserForToken(tokenData);
        let doc = await index_1.dbAccounts.findOne({ userId: data.data[0].id });
        if (doc) {
            await index_1.dbAccounts.updateOne({ userId: data.data[0].id }, { $set: { accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken } });
            this.cacheCodes.set(doc.cacheCode, data.data[0].id);
            return { id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, cacheCode: doc.cacheCode };
        }
        else {
            let cacheCode = (0, uuid_1.v4)();
            let overlayId = (0, uuid_1.v4)();
            this.cacheCodes.set(cacheCode, data.data[0].id);
            this.overlayIds.set(data.data[0].id, overlayId);
            await index_1.dbAccounts.insertOne({ userId: data.data[0].id, accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, cacheCode: cacheCode, overlayId: overlayId });
            return { id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, type: data.data[0].type, description: data.data[0].description, offlinePlaceholderUrl: data.data[0].offline_image_url, name: data.data[0].name, cacheCode: cacheCode, overlayId: overlayId };
        }
    }
    async getUserOAuthAndRegister(code) {
        const tokenData = await (0, auth_1.exchangeCode)(this.clientId, this.clientSecret, code, 'http://localhost');
        let userData = await this.registerUser(tokenData);
        return userData;
    }
    async getUserFromCacheCode(cacheCode) {
        if (!this.cacheCodes.has(cacheCode))
            return undefined;
        let userId = this.cacheCodes.get(cacheCode);
        let overlayId = this.overlayIds.get(userId);
        let user = await this.apiClient.users.getUserById(userId);
        if (!user)
            return undefined;
        return { broadcasterType: user.broadcasterType, creationDate: user.creationDate, description: user.description, displayName: user.displayName, id: user.id, name: user.name, offlinePlaceholderUrl: user.offlinePlaceholderUrl, profilePictureUrl: user.profilePictureUrl, type: user.type, overlayId: overlayId };
    }
}
exports.TwitchBot = TwitchBot;
