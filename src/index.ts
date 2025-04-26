import {HttpServer} from "./http";
import requests from "./api/impl/requests";
import {Database} from "./data/mongo";
import {TwitchBot} from "./twitch/twitch";

export let database = new Database("strimlyUser", "e5uTs46F0mTW8AZ8", "Strimly");
export let dbAccounts = database.mongoClient.db("Strimly").collection("accounts");
// @ts-ignore
export let httpApi = new HttpServer("StrimlyApi", 4525, ["https://strimly.marcey.xyz", "https://strimly.marcey.xyz/", /\.marcey\.xyz$/], requests);
export let twitchBot = new TwitchBot("012nyl7y9owvlzwadu2qljbg8qp0nr", "9n0dh88kt4xm246zx1ei3x2w5j4dz0", "790570730");
