"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwitchBot = void 0;
const auth_1 = require("@twurple/auth");
const index_1 = require("../index");
const api_1 = require("@twurple/api");
const uuid_1 = require("uuid");
const chat_1 = require("@twurple/chat");
class TwitchBot {
    constructor(clientId, clientSecret, botId) {
        this.chatClient = null;
        /*cacheCode, userId*/
        this.cacheCodes = new Map();
        /*userId, overlayId*/
        this.overlayIds = new Map();
        /**/
        this.users = new Map();
        //channelId, lastTTS timestamp
        this.cooldownCommands = new Map();
        //userId, lastTTS timestamp
        this.cooldownUsers = new Map();
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
            if (!doc.ignoreChat) {
                this.cacheCodes.set(doc.cacheCode, doc.userId);
                this.overlayIds.set(doc.userId, doc.overlayId);
                this.users.set(doc.cacheCode, { overlayId: doc.overlayId, userName: doc.userName, cacheCode: doc.cacheCode, userId: doc.userId, ttsData: { ttsCmdEnabled: doc.ttsCmdEnabled, ttsCmdRoles: doc.ttsCmdRoles,
                        ttsCmdCooldown: doc.ttsCmdCooldown, ttsCmdAlias: doc.ttsCmdAlias, ttsRewardEnabled: doc.ttsRewardEnabled, ttsRewardId: doc.ttsRewardId, ttsRewardRoles: doc.ttsRewardRoles } });
                this.authProvider.addUser(doc.userId, {
                    accessToken: doc.accessToken,
                    refreshToken: doc.refreshToken,
                    expiresIn: 0,
                    obtainmentTimestamp: 0
                }, ["chat"]);
            }
            else {
                this.authProvider.addUser(doc.userId, {
                    accessToken: doc.accessToken,
                    refreshToken: doc.refreshToken,
                    expiresIn: 0,
                    obtainmentTimestamp: 0
                }, ["chat"]);
            }
        });
        console.log("has user: " + this.authProvider.hasUser("790570730"));
        console.log("chat client creating...");
        this.chatClient = new chat_1.ChatClient({ authProvider: this.authProvider, channels: ["MarceyBot"] });
        console.log("chat client connecting...");
        this.chatClient.connect();
        console.log("chat client connected maybe");
        this.chatClient.onAuthenticationSuccess(() => {
            this.users.forEach((value, key) => {
                this.joinChannel(value.userName);
            });
        });
        console.log("message event registering...");
        this.chatClient.onMessage(this.onMessage.bind(this));
        console.log("message event registered");
    }
    //Events
    async onMessage(channel, user, text, msg) {
        console.log(channel + " " + user + ": " + text);
        if (!msg.channelId)
            return;
        if (msg.channelId === this.botId)
            return;
        let userData = this.getUserDataSyncFromChannelId(msg.channelId);
        if (!userData)
            return;
        let cmds = userData.ttsData.ttsCmdAlias;
        let args = text.trim().split(/\s+/);
        if (userData.ttsData.ttsCmdEnabled && cmds.includes(args[0])) {
            this.onTTSMessage(channel, user, text, msg, userData, args);
            return;
        }
        if (args[0].toLowerCase() === "!skiptts" || args[0].toLowerCase() === "!ttsskip") {
            if (msg.userInfo.isMod || msg.userInfo.isBroadcaster) {
                if (this.isOnUserCooldown(userData, msg.channelId, args[0]))
                    return;
                if (this.isOnCooldown(userData, msg.channelId, args[0]))
                    return;
                this.onSkipTTSMessage(channel, user, text, msg, userData, args);
            }
            return;
        }
    }
    async onSkipTTSMessage(channel, user, text, msg, userData, args) {
        index_1.webSocketServer.send(userData.overlayId, { event: "skip" });
    }
    async onTTSMessage(channel, user, text, msg, userData, args) {
        let trusted = msg.userInfo.isBroadcaster || userData.ttsData.ttsCmdRoles.some(role => {
            switch (role) {
                case 'user': return true;
                case 'subscriber': return msg.userInfo.isSubscriber;
                case 'founder': return msg.userInfo.isFounder;
                case 'artist': return msg.userInfo.isArtist;
                case 'vip': return msg.userInfo.isVip;
                case 'mods': return msg.userInfo.isMod;
                default: return false;
            }
        });
        if (!trusted)
            return;
        if (args.length <= 1)
            return;
        if (this.isOnUserCooldown(userData, msg.channelId, args[0]))
            return;
        let isOnCommandCooldown = this.isOnCooldown(userData, msg.channelId, userData.ttsData.ttsCmdAlias[0], (userData.ttsData.ttsCmdCooldown * 1000));
        console.log("on cooldown: " + isOnCommandCooldown);
        if (isOnCommandCooldown)
            return;
        let ttsText = args.slice(1).join(' ');
        let ttsData = await this.generateTTS(ttsText);
        if (!ttsData)
            return;
        index_1.webSocketServer.send(userData.overlayId, { userName: msg.userInfo.displayName, ttsText: ttsText, data: ttsData });
    }
    isOnCooldown(userData, channelId, cmd, cooldownReq) {
        const now = Date.now();
        const lastUsed = this.cooldownCommands.get(channelId) || undefined;
        if (!lastUsed) {
            this.cooldownCommands.set(channelId, [{ cmd: cmd, timestamp: now }]);
            return false;
        }
        let cooldown = lastUsed.find(cd => cd.cmd === cmd);
        if (!cooldown) {
            lastUsed.push({ cmd: cmd, timestamp: now });
            this.cooldownCommands.set(channelId, lastUsed);
            return false;
        }
        if (now - cooldown.timestamp < (cooldownReq ? cooldownReq : 2000)) {
            console.log(`TTS command blocked due to cooldown on channel ${channelId} on command ${cmd}`);
            return true;
        }
        else {
            let newCooldowns = lastUsed.filter(cd => cd.cmd !== cmd);
            this.cooldownCommands.set(channelId, newCooldowns);
        }
        return false;
    }
    isOnUserCooldown(userData, channelId, cmd) {
        const now = Date.now();
        const lastUserUsed = this.cooldownUsers.get(userData.userId) || undefined;
        if (!lastUserUsed) {
            this.cooldownUsers.set(userData.userId, [{ cmd: cmd, timestamp: now }]);
            return false;
        }
        let userCooldown = lastUserUsed.find(userCooldown => userCooldown.cmd === cmd);
        if (!userCooldown) {
            lastUserUsed.push({ cmd: cmd, timestamp: now });
            this.cooldownUsers.set(userData.userId, lastUserUsed);
            return false;
        }
        if (now - userCooldown.timestamp < 3000) {
            console.log("TTS command blocked due to cooldown on user");
            return true;
        }
        else {
            let newCooldowns = lastUserUsed.filter(userCooldown => userCooldown.cmd !== cmd);
            this.cooldownUsers.set(userData.userId, newCooldowns);
        }
        return false;
    }
    async generateTTS(text) {
        const options = {
            method: "POST",
            headers: {
                accept: "application/json",
                "content-type": "application/json",
                authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTgyNmUwYjUtOTBiZC00MjliLWEyYzAtNTdkYmM4NTViNmEzIiwidHlwZSI6ImFwaV90b2tlbiJ9.PzCuYTX0xKeUw4DAWDwVNYjGTnEm2DUhjVLREQ3lFGw",
            },
            body: JSON.stringify({
                response_as_dict: true,
                attributes_as_list: false,
                show_original_response: false,
                settings: { amazon: "de-DE_Hans_Standard" },
                rate: 0,
                pitch: 0,
                volume: 0,
                sampling_rate: 0,
                providers: "amazon",
                text: text,
                language: "de",
            })
        };
        try {
            let response = await fetch("https://api.edenai.run/v2/audio/text_to_speech", options);
            if (!response.ok)
                return undefined;
            return await response.json();
        }
        catch (e) {
            console.error(e);
            return undefined;
        }
    }
    //
    async catchChatJoin(key, value) {
        let user = await this.apiClient.users.getUserById(value.userId);
        if (!user) {
            console.log(`Couldn't catch the channel join of ${value.userName}`);
            return;
        }
        let newUser = this.users.get(key);
        if (!newUser) {
            console.log(`Couldn't catch the channel join of ${value.userName}`);
            return;
        }
        newUser.userName = user.displayName;
        this.users.set(key, newUser);
        await this.chatClient.join(newUser.userName);
        console.log(`Channel join successfully catched of ${value.userName} (username change: ${value.userName} -> ${newUser.userName})`);
    }
    async joinChannel(userName) {
        console.log(`trying joining ${userName}`);
        try {
            await this.chatClient.join(userName);
            console.log(`Joined channel ${userName}`);
        }
        catch (e) {
            console.error(e);
            console.log(`Couldn't join channel ${userName}`);
        }
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
        await this.authProvider.addUserForToken(tokenData, ["chat"]);
        let doc = await index_1.dbAccounts.findOne({ userId: data.data[0].id });
        this.joinChannel(data.data[0].display_name);
        if (doc) {
            await index_1.dbAccounts.updateOne({ userId: data.data[0].id }, { $set: { accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, userName: data.data[0].display_name } });
            this.cacheCodes.set(doc.cacheCode, data.data[0].id);
            this.users.set(doc.cacheCode, { userId: data.data[0].id, userName: data.data[0].display_name, cacheCode: doc.cacheCode, overlayId: doc.overlayId, ttsData: { ttsCmdEnabled: doc.ttsCmdEnabled, ttsCmdRoles: doc.ttsCmdRoles,
                    ttsCmdCooldown: doc.ttsCmdCooldown, ttsCmdAlias: doc.ttsCmdAlias, ttsRewardEnabled: doc.ttsRewardEnabled, ttsRewardId: doc.ttsRewardId, ttsRewardRoles: doc.ttsRewardRoles } });
            return { id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, cacheCode: doc.cacheCode };
        }
        else {
            let cacheCode = (0, uuid_1.v4)();
            let overlayId = (0, uuid_1.v4)();
            this.cacheCodes.set(cacheCode, data.data[0].id);
            this.overlayIds.set(data.data[0].id, overlayId);
            await index_1.dbAccounts.insertOne({ userId: data.data[0].id, userName: data.data[0].display_name, accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, cacheCode: cacheCode, overlayId: overlayId,
                ttsCmdEnabled: false, ttsCmdRoles: ['user', 'vip', 'mods'], ttsCmdCooldown: 60, ttsCmdAlias: ['!tts', '!say', '!speak'], ttsRewardEnabled: false, ttsRewardRoles: ['user', 'vip', 'mods'], ttsRewardId: null });
            this.users.set(cacheCode, { userId: data.data[0].id, userName: data.data[0].display_name, cacheCode: cacheCode, overlayId: overlayId, ttsData: { ttsCmdEnabled: false, ttsCmdRoles: ['user', 'vip', 'mods'],
                    ttsCmdCooldown: 60, ttsCmdAlias: ['!tts', '!say', '!speak'], ttsRewardEnabled: false, ttsRewardId: null, ttsRewardRoles: ['user', 'vip', 'mods'] } });
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
        return { broadcasterType: user.broadcasterType, creationDate: user.creationDate, description: user.description, displayName: user.displayName, id: user.id, name: user.name, offlinePlaceholderUrl: user.offlinePlaceholderUrl, profilePictureUrl: user.profilePictureUrl, type: user.type, overlayId: overlayId, cacheCode: cacheCode };
    }
    getUserDataSync(cacheCode) {
        if (!this.users.has(cacheCode))
            return undefined;
        return this.users.get(cacheCode);
    }
    getUserDataSyncFromChannelId(channelId) {
        let userData = [...this.users.entries()].find(([_, value]) => value.userId === channelId);
        if (!userData) {
            return undefined;
        }
        const [key, value] = userData;
        return value;
    }
    updateTTSDataCache(cacheCode, ttsData) {
        let user = this.getUserDataSync(cacheCode);
        if (!user)
            return undefined;
        user.ttsData = ttsData;
        this.users.set(cacheCode, user);
        this.cooldownCommands.set(user.userId, []);
        return user;
    }
}
exports.TwitchBot = TwitchBot;
