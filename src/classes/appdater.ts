import App from "./app";
import path from "path";
import fs from "fs";
import fetch, {Response} from "node-fetch";
import crypto from "crypto";
import Utils from "./utils";
import 'colors';
import Log from "./log";
import ContainerRepositoryHandler from "./handlers/_base";
import DockerRepositoryHandler from "./handlers/docker";

export default class Appdater {

    public app: App;

    private handlers: ContainerRepositoryHandler[] = [];

    private config: App.Config = null;


    constructor(app: App) {
        this.app = app;
    }

    setApp(app: App): Appdater {
        this.app = app;
        return this;
    }

    getApp(): App {
        return this.app;
    }

    async getConfig(): Promise<App.Config> {
        if (this.config === null) {
            this.config = await this.app.config();
        }
        return this.config;
    }

    setConfig(config: App.Config): Appdater {
        this.config = config;
        return this;
    }

    private async getTagPatternOrResolver(serviceName: string): Promise<App.Tag.Pattern|App.Tag.Resolver> {
        const c = await this.getConfig();
        if (c.services !== undefined &&
            c.services[serviceName] !== undefined &&
            c.services[serviceName].tag !== undefined
        ) {
            let pattern = c.services[serviceName].tag.pattern;
            if (pattern !== undefined) return pattern;
            return c.services[serviceName].tag.resolver;
        }
        return c.tag.pattern !== undefined ? c.tag.pattern : c.tag.resolver;
    }

    async updateTag(): Promise<void> {

        for (const service of this.app.compose().getServices()) {
            this.log(`Image = ${service.getImage().getName()} (${service.getName()})`);
            let tag = undefined;

            if (service.getImage().getName().indexOf(":") !== -1 && service.getImage().getTag().trim().length) continue;
            if (service.getImage().getName().indexOf("@") !== -1 && service.getImage().getDigest().trim().length) continue;

            const patternOrResolver = await this.getTagPatternOrResolver(service.getName());
            if (patternOrResolver instanceof RegExp) {
                tag = await this.getFilteredTag(service,(tag) => {
                    return patternOrResolver.test(tag);
                })
            } else if (typeof patternOrResolver === 'function'){
                tag = await this.getFilteredTag(service,(tag) => {
                    return patternOrResolver(tag);
                })
            } else {
                tag = 'latest';
            }
            service.getImage().setTag(tag);

        }
    }

    async getFilteredTag(service: ComposeParser.Service,validator: (tag: string)=>boolean): Promise<string> {

        const image = service.getImage().getName();

        const handler = this.getHandler(image);

        return handler.fetchTag(image,validator);
    }


    getHandler(image: string): ContainerRepositoryHandler {
        const dockerRepoHandler = new DockerRepositoryHandler();
        dockerRepoHandler.setContext(this);
        return [...this.handlers, dockerRepoHandler].filter(handler => handler.imageMatches(image))[0];
    }

    addContainerRepositoryHandler(handler: ContainerRepositoryHandler): Appdater {
        handler.setContext(this);
        this.handlers.push(handler);
        return this;
    }



    log(message: any): void {
        Log.info(`${this.app.name()}: `.yellow, message);
    }

}