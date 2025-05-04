import {WebSocket} from "ws";
import * as https from "node:https";
import * as fs from "node:fs";
import {IncomingMessage} from "node:http";
const url = require('url');

export class SocketServer {

    //overlayId, webSockets
    public sockets:Map<string, WebSocket[]> = new Map();

    private server;
    private wss;

    constructor() {
        this.server = https.createServer({
            cert: fs.readFileSync("/etc/letsencrypt/live/strimlyws.marcey.xyz/cert.pem"),
            key: fs.readFileSync("/etc/letsencrypt/live/strimlyws.marcey.xyz/privkey.pem"),
        });
        this.wss = new WebSocket.Server({ server: this.server });
        this.server.listen(7455, () => console.log("WebSocket Server started on port 7455"));
        this.wss.on('connection', this.onConnection.bind(this));
    }

    private onConnection(socket:WebSocket, req:IncomingMessage) {
        const query = url.parse(req.url, true).query;
        if(!query.code && !query.type){
            socket.close();
            return;
        }
        const overlayId = query.code;
        console.log("A overlay connected with id " + overlayId);
        const type = query.type;
        this.addSocket(socket, overlayId);
        socket.onmessage = (event) => {
            try {
                let message = event.data.toString();
                const data = JSON.parse(message);
                this.onMessage(data);
            } catch (error) {}
        };
        socket.onclose = () => {
            console.log("A overlay disconnected with id " + overlayId);
            this.removeSocket(socket, overlayId);
        }
    }

    private onMessage(data:any) {

    }

    private addSocket(socket:WebSocket, overlayId:string) {
        if(this.sockets.has(overlayId)) {
            let websockets = this.sockets.get(overlayId);
            websockets?.push(socket);
            this.sockets.set(overlayId, websockets!);
        } else this.sockets.set(overlayId, [socket]);
    }

    private removeSocket(socket:WebSocket, overlayId:string) {
        if(!this.sockets.has(overlayId)) return;
        let arr = this.sockets.get(overlayId)?.filter(item => item !== socket);
        if(!arr) arr = [];
        this.sockets.set(overlayId, arr);
    }

    public send(overlayId:string, data:any) {
        if(!this.sockets.has(overlayId)) return;
        this.sockets.get(overlayId)?.map(socket => {
           if(socket) socket.send(JSON.stringify(data));
        });
    }

}