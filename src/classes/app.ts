import path from 'path'
import * as fs from 'fs'
import url from 'url';
import yaml from 'js-yaml';

const LOCALE_KEY_PATTERN = /^([a-z]{2})_([a-z]{2})$/;

export default class App {

    private readonly appPath: string = '';
    private readonly composePath: string = '';
    private readonly composeData: App.Compose;

    constructor(appPath: string) {
        if (appPath === undefined || appPath === null) throw "Invalid App Path";
        this.appPath = appPath;
        this.composePath = path.resolve(this.getPath(), this.getComposeFilename());
        this.composeData = yaml.load(fs.readFileSync(this.composePath, 'utf8')) as App.Compose;

        if (!this.composeData || typeof this.composeData !== 'object') {
            throw new Error(`Invalid compose file: ${this.composePath}`);
        }

        App.normalizeLocaleKeys(this.composeData);
    }

    getComposeFilename(): string {
        return fs.existsSync(path.resolve(this.getPath(), 'docker-compose.yaml')) ? 'docker-compose.yaml' : 'docker-compose.yml';
    }

    getPath(): string {
        return this.appPath;
    }

    getComposePath(): string {
        return this.composePath;
    }

    folderName(): string {
        return path.basename(this.getPath());
    }

    name(): string {
        return String(this.composeData.name || this.folderName());
    }

    id(): string {
        return String(this.composeData['x-casaos']?.id || '').trim();
    }

    xCasaOS(): App.XCasaOS {
        return this.composeData['x-casaos'] || {};
    }

    services(): { [service: string]: App.ComposeService } {
        return this.composeData.services || {};
    }

    getService(service: string): App.ComposeService | undefined {
        return this.services()[service];
    }

    mainServiceName(): string {
        return String(this.xCasaOS().main || '');
    }

    mainService(): App.ComposeService | undefined {
        return this.getService(this.mainServiceName());
    }

    mainImageReference(): string {
        const service = this.mainService();
        return service === undefined ? '' : String(service.image || '');
    }

    mainImageTag(): string {
        return App.parseImage(this.mainImageReference()).tag;
    }

    image(): string {
        return App.parseImage(this.mainImageReference()).name;
    }

    tag(): string {
        const image = App.parseImage(this.mainImageReference());

        if (image.tag.trim().length) return image.tag;
        if (image.digest.trim().length) return image.digest;

        return 'latest';
    }

    setServiceImageTag(serviceName: string, tag: string): void {
        const service = this.getService(serviceName);
        if (service === undefined) return;

        const image = App.parseImage(String(service.image || ''));
        service.image = `${image.name}:${tag}`;
    }

    compose(): App.Compose {
        return this.composeData;
    }

    async config(): Promise<App.Config | null> {
        const configfile = path.resolve(this.getPath(), 'config.js');

        const pathurl = url.pathToFileURL(configfile).toString();

        if (!fs.existsSync(configfile)) return null;

        return (await import(pathurl)).default;
    }

    static parseImage(reference: string): App.ParsedImage {
        const raw = String(reference || '').trim();
        let namePart = raw;
        let digest = '';
        let tag = '';

        const digestIndex = namePart.indexOf('@');
        if (digestIndex !== -1) {
            digest = namePart.substring(digestIndex + 1);
            namePart = namePart.substring(0, digestIndex);
        }

        const lastSlash = namePart.lastIndexOf('/');
        const lastColon = namePart.lastIndexOf(':');

        if (lastColon > lastSlash) {
            tag = namePart.substring(lastColon + 1);
            namePart = namePart.substring(0, lastColon);
        }

        const segments = namePart.split('/');
        const hasRegistry = segments.length > 1 &&
            (segments[0].includes('.') || segments[0].includes(':') || segments[0] === 'localhost');
        const registry = hasRegistry ? segments.shift() : 'docker.io';
        const repository = segments.join('/');
        const name = hasRegistry ? `${registry}/${repository}` : repository;

        return {
            reference: raw,
            name,
            registry,
            repository,
            tag,
            digest,
        };
    }

    /**
     * Normalize locale keys such as `en_us` to the `ll_CC` form expected by v2.
     */
    static normalizeLocaleKeys(value: any): void {
        if (Array.isArray(value)) {
            value.forEach(item => App.normalizeLocaleKeys(item));
            return;
        }

        if (!value || typeof value !== 'object') return;

        for (const key of Object.keys(value)) {
            const match = LOCALE_KEY_PATTERN.exec(key);
            const normalizedKey = match === null
                ? key
                : `${match[1]}_${match[2].toUpperCase()}`;

            if (normalizedKey !== key) {
                value[normalizedKey] = value[key];
                delete value[key];
            }

            App.normalizeLocaleKeys(value[normalizedKey]);
        }
    }
}
