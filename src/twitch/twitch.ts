import {AccessToken, exchangeCode, RefreshingAuthProvider, StaticAuthProvider} from "@twurple/auth";
import {database, dbAccounts, webSocketServer} from "../index";
import {ApiClient} from "@twurple/api";
import { v4 as uuid } from 'uuid';
import {ChatClient, ChatMessage} from "@twurple/chat";

export interface User {
    userId:string,
    userName:string,
    cacheCode:string,
    overlayId:string,
    ttsData:TTSData
}

export interface TTSData {
    ttsCmdEnabled:boolean,
    ttsCmdRoles:string[],
    ttsCmdCooldown:number,
    ttsCmdAlias:string[],
    ttsRewardEnabled:boolean,
    ttsRewardRoles:string[],
    ttsRewardId:string | null
}

export interface Cooldown {
    cmd:string,
    timestamp:number
}

export class TwitchBot {
    botId:string // = "1301395250"
    authProvider:RefreshingAuthProvider
    apiClient:ApiClient
    chatClient:ChatClient = null!;
    clientId:string

    /*cacheCode, userId*/
    private cacheCodes:Map<string, string> = new Map<string, string>();
    /*userId, overlayId*/
    private overlayIds:Map<string, string> = new Map<string, string>();
    /**/
    public users:Map<string, User> = new Map<string, User>();
    //channelId, lastTTS timestamp
    private cooldownCommands: Map<string, Cooldown[]> = new Map<string, Cooldown[]>();
    //userId, lastTTS timestamp
    private cooldownUsers: Map<string, Cooldown[]> = new Map<string, Cooldown[]>();

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
        this.apiClient = new ApiClient({authProvider: this.authProvider}, );
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
            if(!doc.ignoreChat){
                this.cacheCodes.set(doc.cacheCode, doc.userId);
                this.overlayIds.set(doc.userId, doc.overlayId);
                this.users.set(doc.cacheCode, {overlayId: doc.overlayId, userName: doc.userName, cacheCode: doc.cacheCode, userId: doc.userId, ttsData: {ttsCmdEnabled: doc.ttsCmdEnabled, ttsCmdRoles: doc.ttsCmdRoles,
                        ttsCmdCooldown: doc.ttsCmdCooldown, ttsCmdAlias: doc.ttsCmdAlias, ttsRewardEnabled: doc.ttsRewardEnabled, ttsRewardId: doc.ttsRewardId, ttsRewardRoles: doc.ttsRewardRoles}})
                this.authProvider.addUser(doc.userId, {
                    accessToken: doc.accessToken,
                    refreshToken: doc.refreshToken,
                    expiresIn: 0,
                    obtainmentTimestamp: 0
                }, ["chat"]);
            } else {
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
        this.chatClient = new ChatClient({authProvider: this.authProvider, channels: ["MarceyBot"]});
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

    private async onMessage(channel:string, user:string, text:string, msg:ChatMessage){
        console.log(channel + " " + user + ": " + text);
        if(!msg.channelId) return;
        if(msg.channelId === this.botId) return;
        let userData:User | undefined = this.getUserDataSyncFromChannelId(msg.channelId);
        if(!userData) return;
        let cmds:string[] = userData.ttsData.ttsCmdAlias;
        let args = text.trim().split(/\s+/);
        if(userData.ttsData.ttsCmdEnabled && cmds.includes(args[0])) {
            this.onTTSMessage(channel, user, text, msg, userData, args);
            return;
        }
        if(args[0].toLowerCase() === "!skiptts" || args[0].toLowerCase() === "!ttsskip"){
            if(msg.userInfo.isMod || msg.userInfo.isBroadcaster) {
                if(this.isOnUserCooldown(userData, msg.channelId!, args[0])) return;
                if(this.isOnCooldown(userData, msg.channelId!, args[0])) return;
                this.onSkipTTSMessage(channel, user, text, msg, userData, args);
            }
            return;
        }

    }

    private async onSkipTTSMessage(channel:string, user:string, text:string, msg:ChatMessage, userData:User, args:string[]){
        webSocketServer.send(userData.overlayId, {event: "skip"});
    }

    private async onTTSMessage(channel:string, user:string, text:string, msg:ChatMessage, userData:User, args:string[]){
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
        if(!trusted) return;
        if(args.length <= 1) return;
        if(this.isOnUserCooldown(userData, msg.channelId!, args[0])) return;
        let isOnCommandCooldown = this.isOnCooldown(userData, msg.channelId!, userData.ttsData.ttsCmdAlias[0], (userData.ttsData.ttsCmdCooldown * 1000));
        if(isOnCommandCooldown) return;
        let ttsText = args.slice(1).join(' ');
        let ttsData = await this.generateTTS(ttsText);
        if(!ttsData) return;
        webSocketServer.send(userData.overlayId, {userName: msg.userInfo.displayName, ttsText: ttsText, data: ttsData});
    }

    private isOnCooldown(userData:User, channelId:string, cmd:string, cooldownReq?:number):boolean {
        const now = Date.now();
        const lastUsed = this.cooldownCommands.get(channelId) || undefined;
        if(!lastUsed) {
            this.cooldownCommands.set(channelId, [{cmd: cmd.toLowerCase(), timestamp: now}]);
            return false;
        }
        let cooldown = lastUsed.find(cd => cd.cmd === cmd.toLowerCase());
        if(!cooldown){
            lastUsed.push({cmd: cmd.toLowerCase(), timestamp: now});
            this.cooldownCommands.set(channelId, lastUsed);
            return false;
        }
        if(now - cooldown.timestamp < (cooldownReq ? cooldownReq : 2000)){
            console.log(`TTS command blocked due to cooldown on channel ${channelId} on command ${cmd}`);
            return true;
        } else {
            let newCooldowns = lastUsed.filter(cd => cd.cmd !== cmd.toLowerCase());
            newCooldowns.push({cmd: cmd.toLowerCase(), timestamp: now});
            this.cooldownCommands.set(channelId, newCooldowns);
        }
        return false;
    }

    private isOnUserCooldown(userData:User, channelId:string, cmd:string):boolean {
        const now = Date.now();
        const lastUserUsed = this.cooldownUsers.get(userData.userId) || undefined;
        if(!lastUserUsed){
            this.cooldownUsers.set(userData.userId, [{cmd: cmd, timestamp: now}]);
            return false;
        }
        let userCooldown = lastUserUsed.find(userCooldown => userCooldown.cmd === cmd);
        if(!userCooldown){
            lastUserUsed.push({cmd: cmd, timestamp: now});
            this.cooldownUsers.set(userData.userId, lastUserUsed);
            return false;
        }
        if(now - userCooldown.timestamp < 3000) {
            console.log("TTS command blocked due to cooldown on user");
            return true;
        } else {
            let newCooldowns = lastUserUsed.filter(userCooldown => userCooldown.cmd !== cmd);
            newCooldowns.push({cmd: cmd.toLowerCase(), timestamp: now});
            this.cooldownUsers.set(userData.userId, newCooldowns);
        }
        return false;
    }

    private async generateTTS(text:string){
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
            if(!response.ok) return undefined;
            return await response.json();
        } catch (e){
            console.error(e);
            return undefined;
        }
    }

    //

    private async catchChatJoin(key:string, value:User){
        let user = await this.apiClient.users.getUserById(value.userId);
        if(!user){
            console.log(`Couldn't catch the channel join of ${value.userName}`);
            return;
        }
        let newUser = this.users.get(key);
        if(!newUser) {
            console.log(`Couldn't catch the channel join of ${value.userName}`);
            return;
        }
        newUser.userName = user.displayName;
        this.users.set(key, newUser);
        await this.chatClient.join(newUser.userName);
        console.log(`Channel join successfully catched of ${value.userName} (username change: ${value.userName} -> ${newUser.userName})`);
    }

    private async joinChannel(userName:string){
        console.log(`trying joining ${userName}`);
        try {
            await this.chatClient.join(userName);
            console.log(`Joined channel ${userName}`);
        } catch (e){
            console.error(e);
            console.log(`Couldn't join channel ${userName}`);
        }
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
        await this.authProvider.addUserForToken(tokenData, ["chat"]);
        let doc = await dbAccounts.findOne({userId: data.data[0].id});
        this.joinChannel(data.data[0].display_name);
        if(doc){
            await dbAccounts.updateOne({userId: data.data[0].id}, {$set: {accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, userName: data.data[0].display_name}});
            this.cacheCodes.set(doc.cacheCode, data.data[0].id);
            this.users.set(doc.cacheCode, {userId: data.data[0].id, userName: data.data[0].display_name, cacheCode: doc.cacheCode, overlayId: doc.overlayId, ttsData: {ttsCmdEnabled: doc.ttsCmdEnabled, ttsCmdRoles: doc.ttsCmdRoles,
                    ttsCmdCooldown: doc.ttsCmdCooldown, ttsCmdAlias: doc.ttsCmdAlias, ttsRewardEnabled: doc.ttsRewardEnabled, ttsRewardId: doc.ttsRewardId, ttsRewardRoles: doc.ttsRewardRoles}});
            return {id: data.data[0].id, displayName: data.data[0].display_name, profilePictureUrl: data.data[0].profile_image_url, broadcaster_type: data.data[0].broadcaster_type, cacheCode: doc.cacheCode};
        } else {
            let cacheCode = uuid();
            let overlayId = uuid();
            this.cacheCodes.set(cacheCode, data.data[0].id);
            this.overlayIds.set(data.data[0].id, overlayId);
            await dbAccounts.insertOne({userId: data.data[0].id, userName: data.data[0].display_name, accessToken: tokenData.accessToken, refreshToken: tokenData.refreshToken, cacheCode: cacheCode, overlayId: overlayId,
            ttsCmdEnabled: false, ttsCmdRoles: ['user', 'vip', 'mods'], ttsCmdCooldown: 60, ttsCmdAlias: ['!tts', '!say', '!speak'], ttsRewardEnabled: false, ttsRewardRoles: ['user', 'vip', 'mods'], ttsRewardId: null});
            this.users.set(cacheCode, {userId: data.data[0].id, userName: data.data[0].display_name, cacheCode: cacheCode, overlayId: overlayId, ttsData: {ttsCmdEnabled: false, ttsCmdRoles: ['user', 'vip', 'mods'],
                    ttsCmdCooldown: 60, ttsCmdAlias: ['!tts', '!say', '!speak'], ttsRewardEnabled: false, ttsRewardId: null, ttsRewardRoles: ['user', 'vip', 'mods']}});
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
        return {broadcasterType: user.broadcasterType, creationDate: user.creationDate, description: user.description, displayName: user.displayName, id: user.id, name: user.name, offlinePlaceholderUrl: user.offlinePlaceholderUrl, profilePictureUrl: user.profilePictureUrl, type: user.type, overlayId: overlayId, cacheCode: cacheCode};
    }

    getUserDataSync(cacheCode:string):User | undefined {
        if(!this.users.has(cacheCode)) return undefined;
        return this.users.get(cacheCode);
    }

    getUserDataSyncFromChannelId(channelId:string):User | undefined {
        let userData = [...this.users.entries()].find(([_, value]) => value.userId === channelId);
        if(!userData){
            return undefined;
        }
        const [key, value] = userData;
        return value;
    }

    updateTTSDataCache(cacheCode:string, ttsData:TTSData):User | undefined{
        let user:User | undefined = this.getUserDataSync(cacheCode);
        if(!user) return undefined;
        user.ttsData = ttsData;
        this.users.set(cacheCode, user);
        this.cooldownCommands.set(user.userId, []);
        return user;
    }
}