import path from 'path'
import Parser from "docker-compose-parser";
import * as fs from 'fs'
import url from 'url';

export default class App {

    private readonly appPath: string = '';
    private readonly _compose: ComposeParser = null;

    constructor(appPath: string) {
        if (appPath === undefined || appPath === null) throw "Invalid App Path";
        this.appPath = appPath;

        this._compose = new Parser(path.resolve(this.getPath(),this.getComposeFilename()));
    }

    getComposeFilename(): string {
        return fs.existsSync(path.resolve(this.getPath(),'docker-compose.yaml')) ? 'docker-compose.yaml' : 'docker-compose.yml';
    }

    getPath(): string {
        return this.appPath;
    }

    name(): string {
        return this._compose.name;
    }

    image(): string {
        const mainService = this._compose['x-casaos'].main;

        return this._compose.getService(mainService).getImage().getName();
    }
    tag(): string {
        const mainService = this._compose['x-casaos'].main;

        const image = this._compose.getService(mainService).getImage();

        try {
            if (image.getTag().trim().length) {
                return image.getTag();
            }
            if (image.getDigest().trim().length) {
                return image.getDigest();
            }
        } catch (e) {}
        return 'latest';
    }

    async config(): Promise<App.Config|null> {
        const configfile = path.resolve(this.getPath(),'config.js');

        const pathurl = url.pathToFileURL(configfile).toString();

        if (!fs.existsSync(configfile)) return null;

        return (await import(pathurl)).default;
    }

    compose(): ComposeParser {
        return this._compose;
    }

}
