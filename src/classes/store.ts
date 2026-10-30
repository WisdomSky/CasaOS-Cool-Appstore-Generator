import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import yaml from 'js-yaml';
import App from './app';
import Appdater from './appdater';
import Utils from './utils';
import Log from './log';
import GithubRepositoryHandler from './handlers/github';

export const V2_CATEGORIES = [
    'Media',
    'Productivity',
    'Home',
    'Networking',
    'AI',
    'Finance',
    'Social',
    'Developer',
    'Others',
] as const;

const SUPPORTED_ARCHITECTURES = ['amd64', 'arm64', 'arm', '386'];
const DEFAULT_LOCALE = 'en_US';
const LOCALE_PATTERN = /^[a-z]{2}_[A-Z]{2}$/;
const SAFE_ID_PATTERN = /^(?=.*[a-z0-9])[a-z0-9._-]+$/;
const REVERSE_DOMAIN_PATTERN = /^(?=.{3,}$)(?=.*[a-z0-9])[a-z0-9_-]+(?:\.[a-z0-9_-]+)+$/;
const COMPOSE_NAME_PATTERN = /^[a-z0-9_-]+$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

const RUNTIME_FIELDS = ['id', 'main', 'index', 'port_map', 'scheme', 'icon', 'title', 'version'];
const META_FIELDS = [
    'tagline',
    'description',
    'thumbnail',
    'screenshot_link',
    'tips',
    'author',
    'developer',
    'category',
    'architectures',
    'version',
    'update_at',
    'release_notes',
    'website',
    'repo',
    'support',
    'docs',
];
const I18N_FIELDS = ['title', 'tagline', 'description', 'release_notes'];

const IMAGE_EXTENSIONS = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ASSET_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CONTENT_TYPE_EXTENSIONS: { [contentType: string]: string } = {
    'image/svg+xml': '.svg',
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/vnd.microsoft.icon': '.ico',
    'image/x-icon': '.ico',
};

type StoreConfig = {
    version?: number;
    store_id?: string;
    name?: App.LocalizedText;
    description?: App.LocalizedText;
    maintainer?: string;
    url?: string;
    icon?: string;
};

type AssetSource = {
    buffer: Buffer;
    extension: string;
};

type AssetResult = {
    icon: string;
    thumbnail?: string;
    screenshots: string[];
};

type IndexEntry = {
    id: string;
    title: string;
    tagline: string;
    category: string;
    categories: string[];
    author: string;
    developer: string;
    architectures: string[];
    icon: string;
    thumbnail: string;
    compose_url: string;
    meta_url: string;
    content_hash: string;
    version?: string;
};

export type StoreBuilderOptions = {
    appsDir?: string;
    storeConfigPath?: string;
    supportedLanguagesPath?: string;
};

export default class StoreBuilder {
    private readonly appsDir: string;
    private readonly storeConfigPath: string;
    private readonly supportedLanguagesPath: string;

    private apps: App[] = [];
    private storeConfig: StoreConfig = {};
    private supportedLanguages: string[] = [DEFAULT_LOCALE];
    private warnings: string[] = [];
    private errors: string[] = [];
    private loadErrors: string[] = [];
    private loadWarnings: string[] = [];

    constructor(options: StoreBuilderOptions = {}) {
        this.appsDir = options.appsDir || path.resolve('src/apps');
        this.storeConfigPath = options.storeConfigPath || path.resolve('store-config.json');
        this.supportedLanguagesPath = options.supportedLanguagesPath || path.resolve('supported-languages.json');
    }

    load(): void {
        this.errors = [];
        this.warnings = [];

        this.loadStoreConfig();
        this.loadSupportedLanguages();
        this.loadApps();

        this.loadErrors = [...this.errors];
        this.loadWarnings = [...this.warnings];
    }

    appCount(): number {
        return this.apps.length;
    }

    private loadStoreConfig(): void {
        if (!fs.existsSync(this.storeConfigPath)) {
            this.errors.push(`Missing required v2 store file: ${this.storeConfigPath}`);
            return;
        }

        try {
            this.storeConfig = Utils.readJson<StoreConfig>(this.storeConfigPath);
        } catch (e) {
            this.errors.push(`Invalid JSON in ${this.storeConfigPath}: ${e}`);
            return;
        }

        if (this.storeConfig.version !== 2) {
            this.errors.push(`${this.storeConfigPath}: "version" must be the integer 2.`);
        }

        const storeId = String(this.storeConfig.store_id || '').trim().toLowerCase();
        if (!SAFE_ID_PATTERN.test(storeId)) {
            this.errors.push(`${this.storeConfigPath}: "store_id" must contain only letters, digits, dots, underscores, and hyphens.`);
        } else if (storeId === 'zimaos-appstore') {
            this.errors.push(`${this.storeConfigPath}: "store_id" must not use the reserved value "zimaos-appstore".`);
        }

        if (!String(this.storeConfig.maintainer || '').trim()) {
            this.errors.push(`${this.storeConfigPath}: "maintainer" is required.`);
        }

        if (!isLocaleObject(this.storeConfig.name) || !String(this.storeConfig.name[DEFAULT_LOCALE] || '').trim()) {
            this.errors.push(`${this.storeConfigPath}: "name" must be a locale-keyed object with an ${DEFAULT_LOCALE} value.`);
        }

        if (this.storeConfig.description !== undefined && !isLocaleObject(this.storeConfig.description)) {
            this.errors.push(`${this.storeConfigPath}: "description" must be a locale-keyed object.`);
        }
    }

    private loadSupportedLanguages(): void {
        if (!fs.existsSync(this.supportedLanguagesPath)) {
            this.warnings.push(`Missing ${this.supportedLanguagesPath}. Only ${DEFAULT_LOCALE} output will be generated.`);
            this.supportedLanguages = [DEFAULT_LOCALE];
            return;
        }

        try {
            const languages = Utils.readJson<string[]>(this.supportedLanguagesPath);
            if (!Array.isArray(languages)) throw new Error('expected an array of locale keys');

            const normalized = languages
                .map(language => String(language).trim())
                .filter(language => language.length > 0);

            for (const language of normalized) {
                if (!LOCALE_PATTERN.test(language)) {
                    this.errors.push(`${this.supportedLanguagesPath}: invalid locale key "${language}" (expected ll_CC, for example en_US).`);
                }
            }

            if (!normalized.includes(DEFAULT_LOCALE)) normalized.unshift(DEFAULT_LOCALE);
            this.supportedLanguages = [...new Set(normalized)];
        } catch (e) {
            this.errors.push(`Invalid ${this.supportedLanguagesPath}: ${e}`);
            this.supportedLanguages = [DEFAULT_LOCALE];
        }
    }

    private loadApps(): void {
        if (!fs.existsSync(this.appsDir)) {
            this.errors.push(`Apps directory not found: ${this.appsDir}`);
            return;
        }

        const directories = fs.readdirSync(this.appsDir, {withFileTypes: true})
            .filter(entry => entry.isDirectory())
            .map(entry => entry.name)
            .sort();

        for (const directory of directories) {
            const appPath = path.join(this.appsDir, directory);
            const composePath = path.join(appPath, 'docker-compose.yml');
            const composeYamlPath = path.join(appPath, 'docker-compose.yaml');

            if (!fs.existsSync(composePath) && !fs.existsSync(composeYamlPath)) {
                this.warnings.push(`Skipped ${directory}: no docker-compose.yml or docker-compose.yaml found.`);
                continue;
            }

            try {
                this.apps.push(new App(appPath));
            } catch (e) {
                this.errors.push(`${directory}: failed to read compose file: ${e}`);
            }
        }
    }

    async updateTags(): Promise<void> {
        for (const app of this.apps) {
            const updater = new Appdater(app);
            updater.addContainerRepositoryHandler(new GithubRepositoryHandler());
            await updater.updateTags();
        }
    }

    validate(): { errors: string[]; warnings: string[] } {
        this.errors = [...this.loadErrors];
        this.warnings = [...this.loadWarnings];
        const appIds = new Map<string, string>();

        for (const app of this.apps) {
            const label = app.folderName();
            const x = app.xCasaOS();

            if (!x || Object.keys(x).length === 0) {
                this.errors.push(`${label}: missing top-level x-casaos block.`);
                continue;
            }

            const name = app.name();
            if (!COMPOSE_NAME_PATTERN.test(name)) {
                this.errors.push(`${label}: top-level name "${name}" must match ${COMPOSE_NAME_PATTERN}.`);
            }

            const id = String(x.id || '').trim().toLowerCase();
            if (!REVERSE_DOMAIN_PATTERN.test(id)) {
                this.errors.push(`${label}: x-casaos.id is required and must use reverse-domain style (for example com.example.myapp).`);
            } else if (appIds.has(id)) {
                this.errors.push(`${label}: duplicate x-casaos.id "${id}" (also used by ${appIds.get(id)}).`);
            } else {
                appIds.set(id, label);
            }

            const main = String(x.main || '');
            if (!main || app.getService(main) === undefined) {
                this.errors.push(`${label}: x-casaos.main "${main}" must reference an existing service.`);
            }

            if (!String(x.index || '').startsWith('/')) {
                this.errors.push(`${label}: x-casaos.index is required and must start with "/".`);
            }

            if (typeof x.port_map !== 'string' || !/^\d+$/.test(x.port_map)) {
                this.errors.push(`${label}: x-casaos.port_map is required and must be a quoted numeric string.`);
            }

            if (!String(x.icon || '').trim()) {
                this.errors.push(`${label}: x-casaos.icon is required.`);
            }

            if (!isLocaleObject(x.title) || !String(x.title[DEFAULT_LOCALE] || '').trim()) {
                this.errors.push(`${label}: x-casaos.title must be a locale-keyed object with an ${DEFAULT_LOCALE} value.`);
            }

            if (!V2_CATEGORIES.includes(String(x.category || '') as any)) {
                this.errors.push(`${label}: x-casaos.category "${x.category}" must be one of: ${V2_CATEGORIES.join(', ')}.`);
            }

            if (!Array.isArray(x.architectures) || x.architectures.length === 0) {
                this.errors.push(`${label}: x-casaos.architectures must be a non-empty array.`);
            } else {
                for (const architecture of x.architectures) {
                    if (!SUPPORTED_ARCHITECTURES.includes(String(architecture))) {
                        this.errors.push(`${label}: unsupported architecture "${architecture}" (expected one of: ${SUPPORTED_ARCHITECTURES.join(', ')}).`);
                    }
                }
            }

            if (!String(x.version || '').trim()) {
                this.errors.push(`${label}: x-casaos.version is required.`);
            }

            if (!isLocaleObject(x.description) || !String(x.description[DEFAULT_LOCALE] || '').trim()) {
                this.warnings.push(`${label}: x-casaos.description.${DEFAULT_LOCALE} is recommended.`);
            }

            if (!isLocaleObject(x.tagline) || !String(x.tagline[DEFAULT_LOCALE] || '').trim()) {
                this.warnings.push(`${label}: x-casaos.tagline.${DEFAULT_LOCALE} is recommended.`);
            }

            if (!String(x.author || '').trim()) {
                this.warnings.push(`${label}: x-casaos.author is recommended.`);
            }

            if (!String(x.developer || '').trim()) {
                this.warnings.push(`${label}: x-casaos.developer is recommended.`);
            }

            if (x.screenshot_link !== undefined && !Array.isArray(x.screenshot_link)) {
                this.errors.push(`${label}: x-casaos.screenshot_link must be an array.`);
            }

            this.validateAssetReference(label, 'icon', x.icon);
            this.validateAssetReference(label, 'thumbnail', x.thumbnail);
            if (Array.isArray(x.screenshot_link)) {
                x.screenshot_link.forEach((screenshot, index) => {
                    this.validateAssetReference(label, `screenshot_link[${index}]`, screenshot);
                });
            }

            if (Object.keys(app.services()).length === 0) {
                this.errors.push(`${label}: compose file must define at least one service.`);
            }

            if (!String(app.mainImageReference()).trim()) {
                this.errors.push(`${label}: main service must define an image.`);
            }
        }

        return {errors: this.errors, warnings: this.warnings};
    }

    private validateAssetReference(appLabel: string, field: string, value: any): void {
        if (value === undefined || value === null || String(value).trim().length === 0) return;

        const reference = String(value);
        if (/^https?:\/\//i.test(reference)) return;

        const localPath = path.resolve(this.appsDir, appLabel, reference);
        if (!fs.existsSync(localPath)) {
            this.errors.push(`${appLabel}: ${field} references a missing local asset: ${reference}`);
        }
    }

    async build(outputDir: string, baseUrl: string = ''): Promise<void> {
        const {errors} = this.validate();
        if (errors.length > 0) {
            throw new Error(`Refusing to build an invalid store. Fix ${errors.length} validation error(s) first.`);
        }

        const resolvedOutput = path.resolve(outputDir);
        const cwd = path.resolve('.');
        const protectedRoots = [path.resolve('src'), path.resolve('.git')];

        if (resolvedOutput === cwd || cwd.startsWith(resolvedOutput + path.sep)) {
            throw new Error(`Refusing to use the repository root or one of its parents as build output: ${resolvedOutput}`);
        }

        for (const protectedRoot of protectedRoots) {
            if (resolvedOutput === protectedRoot || resolvedOutput.startsWith(protectedRoot + path.sep)) {
                throw new Error(`Refusing to use protected path as build output: ${resolvedOutput}`);
            }
        }

        const normalizedBaseUrl = Utils.normalizeBaseUrl(baseUrl);
        Utils.removeDir(resolvedOutput);
        Utils.createDir(resolvedOutput);

        // Copy shared assets (banner, default icon, category list, ...).
        if (fs.existsSync('src/assets')) {
            Utils.copyDir('src/assets', outputDir, ['README.md']);
        }

        this.writeStoreFiles(outputDir);

        const indexEntries: IndexEntry[] = [];
        const appLocales: { [appId: string]: Set<string> } = {};
        const appVersions: { [appId: string]: string } = {};

        for (const app of this.apps) {
            const id = String(app.xCasaOS().id || '').trim().toLowerCase();
            const appOutput = path.join(outputDir, 'apps', id);
            const assetsOutput = path.join(appOutput, 'assets');

            Utils.createDir(appOutput, assetsOutput);

            const assets = await this.processAssets(app, assetsOutput);
            const assetsPath = `/apps/${id}/assets`;
            const version = this.versionFor(app);

            const compose = this.buildCompose(app, assets, assetsPath, version, normalizedBaseUrl);
            fs.writeFileSync(path.join(appOutput, 'docker-compose.yml'), dumpYaml(compose));

            const meta = this.buildMeta(app, assets, assetsPath, version, normalizedBaseUrl);
            Utils.writeJson(path.join(appOutput, 'meta.json'), meta);

            const locales = this.appLocales(app);
            appLocales[id] = locales;
            for (const locale of locales) {
                if (locale === DEFAULT_LOCALE || !this.supportedLanguages.includes(locale)) continue;

                const overlay = this.buildMetaOverlay(app, locale);
                Utils.writeJson(path.join(appOutput, `meta.${locale}.json`), overlay);
            }

            const iconPath = `${assetsPath}/${assets.icon}`;
            const contentHash = Utils.hashDirectory(appOutput);
            const indexEntry: IndexEntry = {
                id,
                title: resolveLocale(app.xCasaOS().title),
                tagline: resolveLocale(app.xCasaOS().tagline),
                category: String(app.xCasaOS().category || ''),
                categories: normalizeCategories(app.xCasaOS().category),
                author: String(app.xCasaOS().author || ''),
                developer: String(app.xCasaOS().developer || ''),
                architectures: (app.xCasaOS().architectures || []).map(value => String(value)),
                icon: iconPath,
                thumbnail: meta.thumbnail || '',
                compose_url: `/apps/${id}/docker-compose.yml`,
                meta_url: `/apps/${id}/meta.json`,
                content_hash: contentHash,
            };

            if (SEMVER_PATTERN.test(version)) {
                indexEntry.version = version;
            } else {
                this.warnings.push(`${id}: x-casaos.version "${version}" is not semver; it will be omitted from index.json.`);
            }

            indexEntries.push(indexEntry);
            appVersions[id] = version;
            Log.info(`  OK   ${id}`);
        }

        indexEntries.sort((a, b) => a.title.localeCompare(b.title));

        this.writeIndexFiles(outputDir, normalizedBaseUrl, indexEntries, appLocales);
        this.writeReadme(outputDir, normalizedBaseUrl, indexEntries, appVersions);

        for (const warning of this.warnings) {
            Log.error(`WARN  ${warning}`);
        }
    }

    private writeStoreFiles(outputDir: string): void {
        const config = this.storeConfig;
        const storeId = String(config.store_id || '').trim().toLowerCase();

        const store = {
            version: 2,
            store_id: storeId,
            name: resolveLocale(config.name),
            description: resolveLocale(config.description),
            maintainer: String(config.maintainer || ''),
            url: String(config.url || ''),
            ...(config.icon ? {icon: config.icon} : {}),
        };

        Utils.writeJson(path.join(outputDir, 'store.json'), store);

        const storeLocales = new Set<string>([
            ...collectLocales(config.name),
            ...collectLocales(config.description),
        ]);

        for (const locale of storeLocales) {
            if (locale === DEFAULT_LOCALE || !this.supportedLanguages.includes(locale)) continue;

            Utils.writeJson(path.join(outputDir, `store.${locale}.json`), {
                store_id: storeId,
                ...(config.name?.[locale] ? {name: config.name[locale]} : {}),
                ...(config.description?.[locale] ? {description: config.description[locale]} : {}),
            });
        }
    }

    private writeIndexFiles(
        outputDir: string,
        baseUrl: string,
        entries: IndexEntry[],
        appLocales: { [appId: string]: Set<string> },
    ): void {
        const index = {
            version: 2,
            updated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
            app_count: entries.length,
            base_url: baseUrl,
            apps: entries,
        };

        Utils.writeJson(path.join(outputDir, 'index.json'), index);

        const localeEntries: { [locale: string]: any[] } = {};
        for (const entry of entries) {
            const app = this.apps.find(candidate => candidate.id().toLowerCase() === entry.id);
            if (!app) continue;

            for (const locale of appLocales[entry.id] || new Set<string>()) {
                if (locale === DEFAULT_LOCALE || !this.supportedLanguages.includes(locale)) continue;

                const overlay: any = {id: entry.id};
                if (app.xCasaOS().title?.[locale]) overlay.title = app.xCasaOS().title[locale];
                if (app.xCasaOS().tagline?.[locale]) overlay.tagline = app.xCasaOS().tagline[locale];

                if (Object.keys(overlay).length > 1) {
                    localeEntries[locale] = localeEntries[locale] || [];
                    localeEntries[locale].push(overlay);
                }
            }
        }

        for (const [locale, apps] of Object.entries(localeEntries)) {
            if (apps.length === 0) continue;
            Utils.writeJson(path.join(outputDir, `index.${locale}.json`), {apps});
        }
    }

    private writeReadme(
        outputDir: string,
        baseUrl: string,
        entries: IndexEntry[],
        versions: { [appId: string]: string },
    ): void {
        const templatePath = 'src/assets/README.md';
        if (!fs.existsSync(templatePath)) return;

        const rows = entries.map(entry => {
            const icon = Utils.urlJoin(baseUrl, entry.icon);
            const title = entry.title.replace(/\|/g, '\\|');
            const tagline = String(entry.tagline || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
            const version = versions[entry.id] || entry.version || '';
            return `| <img src="${icon}" width="15"/>&nbsp;&nbsp;&nbsp;${title} | ${version} | ${tagline} |`;
        });

        let readme = fs.readFileSync(templatePath, 'utf8');
        readme = readme.replace(/%APPSLIST%/g, rows.join('\n'));
        readme = readme.replace(/%APP_COUNT%/g, String(entries.length));
        readme = readme.replace(/%STORE_URL%/g, Utils.urlJoin(baseUrl, 'store.json'));

        fs.writeFileSync(path.join(outputDir, 'README.md'), readme);
    }

    private versionFor(app: App): string {
        const tag = app.mainImageTag().trim();
        const sourceVersion = String(app.xCasaOS().version || '').trim();
        const raw = tag.length > 0 ? tag : sourceVersion;

        return raw
            .replace(/^version-/, '')
            .replace(/^alpine-v(?=\d)/, '')
            .replace(/^v(?=\d)/, '') || 'latest';
    }

    private buildCompose(
        app: App,
        assets: AssetResult,
        assetsPath: string,
        version: string,
        baseUrl: string,
    ): App.Compose {
        const source = clone(app.compose());
        const sourceX = source['x-casaos'] || {};

        for (const service of Object.values(source.services || {})) {
            delete service['x-casaos'];
            if (service.labels && typeof service.labels === 'object') {
                delete service.labels.icon;
                if (Object.keys(service.labels).length === 0) delete service.labels;
            }
        }

        const runtime: any = {};
        for (const field of RUNTIME_FIELDS) {
            if (sourceX[field] === undefined) continue;

            if (field === 'title') {
                runtime.title = resolveLocale(sourceX.title);
            } else if (field === 'icon') {
                runtime.icon = Utils.urlJoin(baseUrl, `${assetsPath}/${assets.icon}`);
            } else if (field === 'version') {
                runtime.version = version;
            } else {
                runtime[field] = sourceX[field];
            }
        }

        runtime.id = String(sourceX.id || '').toLowerCase();
        runtime.port_map = String(sourceX.port_map || '');
        runtime.version = version;

        source['x-casaos'] = runtime;

        return source;
    }

    private buildMeta(
        app: App,
        assets: AssetResult,
        assetsPath: string,
        version: string,
        baseUrl: string,
    ): any {
        const source = app.xCasaOS();
        const meta: any = {};

        for (const field of META_FIELDS) {
            if (source[field] === undefined) continue;

            if (I18N_FIELDS.includes(field)) {
                meta[field] = resolveLocale(source[field]);
            } else if (field === 'tips') {
                meta[field] = resolveTips(source.tips);
            } else {
                meta[field] = clone(source[field]);
            }
        }

        if (meta.release_notes !== undefined) {
            meta.release_note = meta.release_notes;
            delete meta.release_notes;
        }

        meta.id = String(source.id || '').toLowerCase();
        meta.version = version;
        meta.categories = normalizeCategories(source.category);
        meta.base_url = Utils.normalizeBaseUrl(baseUrl);
        meta.thumbnail = assets.thumbnail ? `${assetsPath}/${assets.thumbnail}` : '';
        meta.screenshot_link = assets.screenshots.map(file => `${assetsPath}/${file}`);

        return meta;
    }

    private buildMetaOverlay(app: App, locale: string): any {
        const source = app.xCasaOS();
        const overlay: any = {id: String(source.id || '').toLowerCase()};

        if (source.title?.[locale]) overlay.title = source.title[locale];
        if (source.tagline?.[locale]) overlay.tagline = source.tagline[locale];
        if (source.description?.[locale]) overlay.description = source.description[locale];
        if (source.release_notes?.[locale]) overlay.release_note = source.release_notes[locale];

        if (source.tips && typeof source.tips === 'object') {
            const tips: any = {};
            for (const [key, value] of Object.entries(source.tips)) {
                if (isLocaleObject(value) && value[locale]) tips[key] = value[locale];
            }
            if (Object.keys(tips).length > 0) overlay.tips = tips;
        }

        return overlay;
    }

    private appLocales(app: App): Set<string> {
        const x = app.xCasaOS();
        const locales = new Set<string>();

        for (const field of I18N_FIELDS) {
            for (const locale of collectLocales(x[field])) locales.add(locale);
        }

        if (x.tips && typeof x.tips === 'object') {
            for (const value of Object.values(x.tips)) {
                for (const locale of collectLocales(value)) locales.add(locale);
            }
        }

        return locales;
    }

    private async processAssets(app: App, assetsOutput: string): Promise<AssetResult> {
        const x = app.xCasaOS();
        const cache = new Map<string, AssetSource>();

        let icon = await this.resolveAsset(app, String(x.icon || ''), cache, false);
        if (icon === undefined) {
            this.warnings.push(`${app.folderName()}: using the default icon because ${x.icon} could not be loaded.`);
            icon = defaultIcon();
        }
        if (icon === undefined) {
            throw new Error(`${app.folderName()}: unable to resolve required icon ${x.icon}`);
        }

        const thumbnail = x.thumbnail
            ? await this.resolveAsset(app, String(x.thumbnail), cache, false)
            : undefined;

        const screenshots: string[] = [];
        const screenshotRefs = Array.isArray(x.screenshot_link) ? x.screenshot_link : [];

        for (let index = 0; index < screenshotRefs.length; index++) {
            const source = await this.resolveAsset(app, String(screenshotRefs[index]), cache, false);
            if (source === undefined) continue;

            const filename = `screenshot-${index + 1}${source.extension}`;
            fs.writeFileSync(path.join(assetsOutput, filename), source.buffer);
            screenshots.push(filename);
        }

        const iconFilename = `icon${icon.extension}`;
        fs.writeFileSync(path.join(assetsOutput, iconFilename), icon.buffer);

        let thumbnailFilename: string | undefined;
        if (thumbnail !== undefined) {
            thumbnailFilename = `thumbnail${thumbnail.extension}`;
            fs.writeFileSync(path.join(assetsOutput, thumbnailFilename), thumbnail.buffer);
        }

        return {
            icon: iconFilename,
            thumbnail: thumbnailFilename,
            screenshots,
        };
    }

    private async resolveAsset(
        app: App,
        reference: string,
        cache: Map<string, AssetSource>,
        required: boolean,
    ): Promise<AssetSource | undefined> {
        if (!reference.trim()) return undefined;

        const cached = cache.get(reference);
        if (cached !== undefined) return cached;

        try {
            let source: AssetSource;

            if (/^https?:\/\//i.test(reference)) {
                source = await this.downloadAsset(reference);
            } else {
                const localPath = path.resolve(app.getPath(), reference);
                if (!fs.existsSync(localPath)) {
                    throw new Error(`local asset not found: ${reference}`);
                }

                source = {
                    buffer: fs.readFileSync(localPath),
                    extension: normalizeExtension(path.extname(localPath)),
                };
            }

            cache.set(reference, source);
            return source;
        } catch (e) {
            if (required) throw e;
            this.warnings.push(`${app.folderName()}: skipped asset ${reference}: ${e}`);
            return undefined;
        }
    }

    private async downloadAsset(reference: string): Promise<AssetSource> {
        const cacheDir = path.resolve('.cache', 'assets');
        const cacheKey = crypto.createHash('sha256').update(reference).digest('hex');
        const cacheMetaPath = path.join(cacheDir, `${cacheKey}.json`);
        const cacheBinPath = path.join(cacheDir, `${cacheKey}.bin`);

        const cached = this.readAssetCache(cacheMetaPath, cacheBinPath);
        if (cached !== undefined && Date.now() - cached.fetchedAt < ASSET_CACHE_MAX_AGE_MS) {
            return {buffer: cached.buffer, extension: cached.extension};
        }

        try {
            const response = await fetch(reference, {
                headers: {'User-Agent': 'CasaOS-Coolstore-Generator/2.0'},
                redirect: 'follow',
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} while downloading ${reference}`);
            }

            const contentType = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
            let extension = path.extname(new URL(reference).pathname).toLowerCase();

            if (!IMAGE_EXTENSIONS.has(extension)) {
                extension = CONTENT_TYPE_EXTENSIONS[contentType] || '';
            }

            if (!extension) {
                throw new Error(`unable to determine image type for ${reference}`);
            }

            const buffer = Buffer.from(await response.arrayBuffer());
            const source = {
                buffer,
                extension: normalizeExtension(extension),
            };

            Utils.createDir(cacheDir);
            fs.writeFileSync(cacheBinPath, buffer);
            Utils.writeJson(cacheMetaPath, {
                extension: source.extension,
                fetchedAt: Date.now(),
                url: reference,
            });

            return source;
        } catch (e) {
            // A stale cached copy is better than dropping a referenced asset.
            if (cached !== undefined) {
                this.warnings.push(`Using cached copy of ${reference} after download failed: ${e}`);
                return {buffer: cached.buffer, extension: cached.extension};
            }

            throw e;
        }
    }

    private readAssetCache(metaPath: string, binPath: string): (AssetSource & {fetchedAt: number}) | undefined {
        if (!fs.existsSync(metaPath) || !fs.existsSync(binPath)) return undefined;

        try {
            const meta = Utils.readJson<{extension: string; fetchedAt: number}>(metaPath);
            return {
                buffer: fs.readFileSync(binPath),
                extension: normalizeExtension(meta.extension),
                fetchedAt: Number(meta.fetchedAt) || 0,
            };
        } catch (e) {
            return undefined;
        }
    }
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function defaultIcon(): AssetSource | undefined {
    const iconPath = path.resolve('src/assets/default-icon.svg');
    if (!fs.existsSync(iconPath)) return undefined;

    return {
        buffer: fs.readFileSync(iconPath),
        extension: '.svg',
    };
}

function dumpYaml(value: any): string {
    return yaml.dump(value, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
    });
}

function normalizeExtension(extension: string): string {
    const normalized = String(extension || '').toLowerCase();
    if (normalized === '.jpeg') return '.jpg';
    if (IMAGE_EXTENSIONS.has(normalized)) return normalized;
    return normalized || '.png';
}

function isLocaleObject(value: any): value is App.LocalizedText {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function collectLocales(value: any): string[] {
    if (!isLocaleObject(value)) return [];
    return Object.keys(value).filter(key => LOCALE_PATTERN.test(key));
}

function resolveLocale(value: any, locale: string = DEFAULT_LOCALE): string {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return String(value);

    if (typeof value[locale] === 'string') return value[locale];
    if (typeof value[DEFAULT_LOCALE] === 'string') return value[DEFAULT_LOCALE];

    const first = Object.values(value).find(item => typeof item === 'string');
    return typeof first === 'string' ? first : '';
}

function resolveTips(tips: any): any {
    if (!isLocaleObject(tips)) return {};

    const resolved: any = {};
    for (const [key, value] of Object.entries(tips)) {
        resolved[key] = resolveLocale(value);
    }
    return resolved;
}

function normalizeCategories(category: any): string[] {
    const values = Array.isArray(category) ? category : [category];
    const categories: string[] = [];

    for (const value of values) {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized.length > 0 && !categories.includes(normalized)) {
            categories.push(normalized);
        }
    }

    return categories;
}
