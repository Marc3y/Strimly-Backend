//@ts-nocheck
import {MongoClient} from "mongodb/lib/beta";
import {createTunnel} from "tunnel-ssh";

const tunnelOptions = {
    autoClose:false
}

const sshOptions = {
    host: '37.24.240.233',
    port: 22,
    username: 'root',
    password: 'Y48z4pUNZ&dyZKfFr1DGwil3&8Z@oz7Tkd1hQVT8RjIEpQFWhI'
};

const serverOptions = null;

const forwardOptions = {
    dstAddr: '127.0.0.1',
    dstPort: 27017
}

export class Database {
    mongoClient: MongoClient;

    constructor(user, password, database) {
        this.mongoClient = new MongoClient(
            "mongodb://" + user + ":" + password + "@127.0.0.1:27017/?authMechanism=DEFAULT&authSource=" + database,
            {
                useNewUrlParser: true,
                useUnifiedTopology: true
            }
        );
        this.connect();
    }

    async connect() {
        this.mongoClient.connect().then(() => {
            console.log("connected to mongodb");
        });
    }
}
