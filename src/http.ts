//@ts-nocheck
import express, { Request as ExpressRequest, Response as ExpressResponse } from "express";
import cors from "cors"

export interface Request {
    url: string;
    requestType: "GET" | "POST" | "PUT" | "DELETE";
    method(req: ExpressRequest, res: ExpressResponse): Promise<unknown>;
}

export class HttpServer {
    private app = express();

    constructor(id: string, port: number, origins: string[], requests: Request[]) {

        this.app.use(cors());

        for (const req of requests) {
            const { url, requestType, method } = req;

            switch (requestType) {
                case "GET":
                    this.app.get(url, async (req:any, res:any) => await method(req, res));
                    break;
                case "POST":
                    this.app.post(url, async (req, res) => await method(req, res));
                    break;
                case "PUT":
                    this.app.put(url, async (req, res) => await method(req, res));
                    break;
                case "DELETE":
                    this.app.delete(url, async (req, res) => await method(req, res));
                    break;
                default:
                    console.error(`❌ Unsupported request type: ${requestType}`);
            }
        }


        this.app.listen(port, "0.0.0.0", () => {
            console.log(`✅ HTTP-Server '${id}' läuft auf Port ${port}`);
        });
    }
}