import App from "./app";
import path from "path";
import fs from "fs";
import fetch, {Response} from "node-fetch";
import crypto from "crypto";
import Utils from "./utils";
import 'colors';
import Log from "./log";

export default class Appdater {

    private app: App;

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
            let tag = undefined;
            const patternOrResolver = await this.getTagPatternOrResolver(service.getName());
            if (patternOrResolver instanceof RegExp) {
                tag = await this.getFilteredTag((dockerTag) => {
                    return patternOrResolver.test(dockerTag.name);
                })
            } else if (typeof patternOrResolver === 'function'){
                tag = await this.getFilteredTag((dockerTag) => {
                    return patternOrResolver(dockerTag.name);
                })
            } else {
                tag = 'latest';
            }
            service.getImage().setTag(tag);

        }
    }

    async getFilteredTag(validator: (dockerTag: DockerTag)=>boolean): Promise<string> {

        let tag = undefined;
        let page = 0;
        try {
            do {
                tag = await this.fetchTagFromDocker(this.app.image(), ++page, validator);
            } while (tag === undefined);
        } catch(e) {
            this.log(e);
        }

        return tag;
    }

    async fetchTagFromDocker(image: string,page: number = 1, validator: (dockerTag: DockerTag) => boolean):  Promise<string|undefined>  {

        if (page >= 10) throw 'Scanned 10 pages. Surrendering...';

        if (image.indexOf('/') === -1) {
            image = `library/${image}`;
        }

        this.log(`Scanning https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page}`)

        let imagejson = undefined;

        do {
            imagejson = await this.fetchJson(`https://registry.hub.docker.com/v2/repositories/${image}/tags/?page_size=100&page=${page}`)
        } while (imagejson.message !== 'httperror 404: object not found' && imagejson.results === undefined);

        if (imagejson.results === undefined) {
            throw 'Unable to resolve image version';
        }

        const results: DockerTag[] = imagejson.results;
        for (let row of results) {
            let valid = validator(row);
            if (valid) {
                this.log(`Tag matched: ${row.name}`);
                return row.name;
            }
        }
        return undefined;
    }



    private async fetchJson(jsonURL, opts: FetchOptions = {}): Promise<Object> {
        
        let cache = this.getCache(jsonURL, opts.longlivedcache);

        if (cache !== null) {
            this.log('Cache found! Using cached results in .cache directory.')
            return await cache.json();
        }
        let res: any = await this.dfetch(jsonURL, opts);
        const code = res.status;
        res = await (res).json();

        if (code === 200) {
            this.cacheContent(jsonURL, JSON.stringify(res), opts.longlivedcache);
        }

        return res;
    }

    private async dfetch(url, opts) {
        const controller = new AbortController();

        const id = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, {...opts, signal: controller.signal});

        clearTimeout(id);

        return response;
    }


    private cacheContent(url: string, content: string, longlivedCache: boolean = false): void {
        Utils.createDir(
            path.resolve('.cache'),
            path.resolve('.cache', 'longlived'),
            path.resolve('.cache', this.getCurrentDate()),
        );
        const p = path.resolve('.cache', longlivedCache === true ?  'longlived' : this.getCurrentDate(), this.hash(url));

        try {
            fs.writeFileSync(p, content);
        } catch(e) {
            this.log(e);
        }
    }

    private getCache(url:string, longlivedCache:boolean = false): Response|null {
        const p = path.resolve('.cache', longlivedCache === true ?  'longlived' : this.getCurrentDate(), this.hash(url));

        if (fs.existsSync(p)) {
            return new Response(fs.readFileSync(p, 'utf8'), { status: 200, statusText: 'OK'});
        }
        return null;
    }

    private isCache(url:string, longlivedCache:boolean = false): boolean {
        const p = path.resolve('.cache', longlivedCache === true ?  'longlived' : this.getCurrentDate(), this.hash(url));
        return fs.existsSync(p);
    }

    private getCurrentDate(): string {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');

        return year + '-' + month + '-' + day;
    }

    private hash(str: string): string {
        const hash = crypto.createHash('sha256');
        hash.update(str);
        return hash.digest('hex');
    }


    private log(message: string): void {
        Log.info(`${this.app.name()}: `.yellow, message);
    }

}