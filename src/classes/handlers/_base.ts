import Appdater from "../appdater";
import fetch, {Response} from "node-fetch";
import path from "path";
import fs from "fs";
import Log from "../log";
import Utils from "../utils";
import crypto from "crypto";

type Context = Appdater;

export default abstract class ContainerRepositoryHandler {

    protected context: Context;

    public setContext(context: Appdater): ContainerRepositoryHandler {
        this.context = context;
        return this;
    }

    protected async fetchJson(jsonURL, opts: FetchOptions = {}): Promise<Object> {

        let cache = this.getCache(jsonURL, opts.longlivedcache);

        if (cache !== null) {
            this.context.log('Cache found! Using cached results in .cache directory.')
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
            this.context.log(e);
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



    abstract fetchTag(image: string, validator: any): Promise<string|undefined>;
    abstract imageMatches(image: string): boolean;
}