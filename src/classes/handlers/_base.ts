import Appdater from "../appdater";
import fetch, {Response} from "node-fetch";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Utils from "../utils";

type Context = Appdater;

export default abstract class ContainerRepositoryHandler {

    protected context: Context;

    public setContext(context: Appdater): ContainerRepositoryHandler {
        this.context = context;
        return this;
    }

    protected async fetchJson<T>(jsonURL, opts: FetchOptions = {}): Promise<T> {

        let cache = this.getCache(jsonURL, opts.longlivedcache);

        if (cache !== null) {
            this.context.log('Cache found! Using cached results in .cache directory.')
            return await cache.json() as T;
        }

        const res = await this.dfetch(jsonURL, opts);
        const text = await res.text();

        let data: any;
        try {
            data = text.length === 0 ? null : JSON.parse(text);
        } catch (e) {
            throw new Error(`Invalid JSON response from ${jsonURL} (HTTP ${res.status})`);
        }

        if (!res.ok) {
            const message = data?.message || data?.errors?.[0]?.message || res.statusText;
            throw new Error(`HTTP ${res.status} from ${jsonURL}: ${message}`);
        }

        this.cacheContent(jsonURL, text, opts.longlivedcache);

        return data as T;
    }

    private async dfetch(url, opts) {
        const controller = new AbortController();

        const id = setTimeout(() => controller.abort(), 15000);

        try {
            return await fetch(url, {...opts, signal: controller.signal});
        } finally {
            clearTimeout(id);
        }
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
