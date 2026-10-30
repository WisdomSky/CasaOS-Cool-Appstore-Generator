import App from "./app";
import Log from "./log";
import ContainerRepositoryHandler from "./handlers/_base";
import DockerRepositoryHandler from "./handlers/docker";
import GithubRepositoryHandler from "./handlers/github";

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

    private async getTagPatternOrResolver(serviceName: string): Promise<App.Tag.Pattern | App.Tag.Resolver | undefined> {
        const c = await this.getConfig();
        if (c === null) return undefined;

        const serviceConfig = c.services?.[serviceName];
        if (serviceConfig?.tag !== undefined) {
            let pattern = serviceConfig.tag.pattern;
            if (pattern !== undefined) return pattern;
            return serviceConfig.tag.resolver;
        }

        if (c.tag === undefined) return undefined;

        return c.tag.pattern !== undefined ? c.tag.pattern : c.tag.resolver;
    }

    /**
     * Resolve and apply image tags for every service in the app.
     *
     * Images pinned by digest are left untouched. Tagged images are updated when
     * the app config provides a tag pattern/resolver; otherwise `latest` is used.
     */
    async updateTags(): Promise<void> {
        for (const [serviceName, service] of Object.entries(this.app.services())) {
            const parsed = App.parseImage(String(service.image || ''));
            this.log(`Image = ${parsed.name}:${parsed.tag || 'latest'} (${serviceName})`);

            if (parsed.digest.trim().length) {
                this.log('Image is digest-pinned. Skipping.');
                continue;
            }

            const patternOrResolver = await this.getTagPatternOrResolver(serviceName);
            let tag: string | undefined;

            if (patternOrResolver instanceof RegExp) {
                tag = await this.getFilteredTag(parsed.name, (candidate) => {
                    return (patternOrResolver as RegExp).test(candidate);
                });
            } else if (typeof patternOrResolver === 'function') {
                tag = await this.getFilteredTag(parsed.name, (candidate) => {
                    return patternOrResolver(candidate);
                });
            } else {
                tag = 'latest';
            }

            if (tag) {
                this.app.setServiceImageTag(serviceName, tag);
                this.log(`Tag = ${tag}`);
            } else {
                this.log(`Unable to resolve a matching tag for ${parsed.name}. Keeping the current reference.`);
            }
        }
    }

    async getFilteredTag(image: string, validator: (tag: string) => boolean): Promise<string | undefined> {
        const handler = this.getHandler(image);
        if (handler === undefined) {
            this.log(`No repository handler found for image ${image}.`);
            return undefined;
        }

        return handler.fetchTag(image, validator);
    }

    getHandler(image: string): ContainerRepositoryHandler | undefined {
        const dockerRepoHandler = new DockerRepositoryHandler();
        dockerRepoHandler.setContext(this);
        return [...this.handlers, dockerRepoHandler].find(handler => handler.imageMatches(image));
    }

    addContainerRepositoryHandler(handler: ContainerRepositoryHandler): Appdater {
        handler.setContext(this);
        this.handlers.push(handler);
        return this;
    }

    log(message: any): void {
        Log.info(`${this.app.name()}: `, message);
    }
}
