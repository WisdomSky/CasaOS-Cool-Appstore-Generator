import path from 'path';
import fs from 'fs';
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

type StoreConfig = {
    version?: number;
    store_id?: string;
    name?: App.LocalizedText;
    description?: App.LocalizedText;
    maintainer?: string;
    url?: string;
    icon?: string;
};

type SourceEntry = {
    id: string;
    folder: string;
    title: string;
    tagline: string;
    icon: string;
    version: string;
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

    /**
     * Write a v2 source tree. The appstore repository's GitHub workflow runs the
     * official build action and publishes the generated protocol files.
     */
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

        Utils.createDir(resolvedOutput);

        // Remove artifacts produced by the old built-output layout, but never
        // remove the dist directory itself.
        this.removeLegacyBuildOutput(resolvedOutput);

        // Copy shared files, including the appstore repo workflow.
        if (fs.existsSync('src/assets')) {
            Utils.copyDir('src/assets', resolvedOutput, ['README.md']);
        }

        this.copyFileIfExists(this.storeConfigPath, path.join(resolvedOutput, 'store-config.json'));
        this.copyFileIfExists(this.supportedLanguagesPath, path.join(resolvedOutput, 'supported-languages.json'));

        const appsOutput = path.join(resolvedOutput, 'Apps');
        Utils.createDir(appsOutput);

        const expectedFolders = new Set<string>();
        const entries: SourceEntry[] = [];
        const updateAt = new Date().toISOString().slice(0, 10);

        for (const app of this.apps) {
            const folder = app.folderName();
            const appOutput = path.join(appsOutput, folder);
            const version = this.versionFor(app);

            expectedFolders.add(folder);
            Utils.createDir(appOutput);

            const compose = clone(app.compose());
            const x = compose['x-casaos'] || {};
            x.version = version;
            x.update_at = updateAt;
            compose['x-casaos'] = x;

            fs.writeFileSync(path.join(appOutput, 'docker-compose.yml'), dumpYaml(compose));
            this.copyAppSourceFiles(app, appOutput);

            const icon = String(x.icon || '').trim();
            entries.push({
                id: String(x.id || '').trim().toLowerCase(),
                folder,
                title: resolveLocale(x.title),
                tagline: resolveLocale(x.tagline),
                icon: /^https?:\/\//i.test(icon) ? icon : `Apps/${folder}/${icon}`,
                version,
            });

            Log.info(`  OK   ${folder}`);
        }

        this.cleanStaleAppDirs(appsOutput, expectedFolders);
        this.writeReadme(resolvedOutput, baseUrl, entries);

        for (const warning of this.warnings) {
            Log.error(`WARN  ${warning}`);
        }
    }

    private removeLegacyBuildOutput(outputDir: string): void {
        const legacyRootFiles = ['store.json', 'index.json', 'metadata.tar.gz', 'metadata.sha256'];

        for (const entry of fs.readdirSync(outputDir, {withFileTypes: true})) {
            if (!entry.isFile()) continue;

            const name = entry.name;
            const isLegacyJson = /^(?:store|index)\.[A-Za-z]{2}_[A-Za-z]{2}\.json$/.test(name);
            if (legacyRootFiles.includes(name) || isLegacyJson) {
                fs.rmSync(path.join(outputDir, name), {force: true});
                Log.info(`  REMOVED old build file ${name}`);
            }
        }

        // The old built layout used lowercase `apps/` with reverse-domain app IDs.
        // Remove only those app-ID directories so a case-insensitive filesystem
        // does not delete the new `Apps/` source tree.
        const oldAppsDir = path.join(outputDir, 'apps');
        if (fs.existsSync(oldAppsDir)) {
            for (const entry of fs.readdirSync(oldAppsDir, {withFileTypes: true})) {
                if (entry.isDirectory() && entry.name.startsWith('com.wisdomsky.coolstore.')) {
                    Utils.removeDir(path.join(oldAppsDir, entry.name));
                    Log.info(`  REMOVED old built app ${entry.name}`);
                }
            }

            try {
                fs.rmdirSync(oldAppsDir);
                Log.info('  REMOVED empty old apps directory');
            } catch (e) {
                // Not empty (or the same directory as Apps/ on a case-insensitive
                // filesystem), so leave it in place.
            }
        }

        const legacyStoreDir = path.join(outputDir, 'store');
        if (fs.existsSync(legacyStoreDir)) {
            Utils.removeDir(legacyStoreDir);
            Log.info('  REMOVED old store metadata directory');
        }
    }

    private cleanStaleAppDirs(appsOutput: string, expectedFolders: Set<string>): void {
        for (const entry of fs.readdirSync(appsOutput, {withFileTypes: true})) {
            if (!entry.isDirectory() || expectedFolders.has(entry.name)) continue;

            Utils.removeDir(path.join(appsOutput, entry.name));
            Log.info(`  REMOVED stale app ${entry.name}`);
        }
    }

    private copyAppSourceFiles(app: App, destination: string): void {
        const excluded = new Set(['docker-compose.yml', 'docker-compose.yaml', 'config.js']);

        for (const entry of fs.readdirSync(app.getPath(), {withFileTypes: true})) {
            if (excluded.has(entry.name)) continue;

            const source = path.join(app.getPath(), entry.name);
            const target = path.join(destination, entry.name);

            if (entry.isDirectory()) {
                Utils.copyDir(source, target);
            } else if (entry.isFile()) {
                fs.copyFileSync(source, target);
            }
        }
    }

    private copyFileIfExists(source: string, destination: string): void {
        if (!fs.existsSync(source)) return;
        Utils.createDir(path.dirname(destination));
        fs.copyFileSync(source, destination);
    }

    private writeReadme(outputDir: string, baseUrl: string, entries: SourceEntry[]): void {
        const templatePath = 'src/assets/README.md';
        if (!fs.existsSync(templatePath)) return;

        const rows = entries
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(entry => {
                const title = entry.title.replace(/\|/g, '\\|');
                const tagline = String(entry.tagline || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
                return `| <img src="${entry.icon}" width="15"/>&nbsp;&nbsp;&nbsp;[${title}](Apps/${entry.folder}) | ${entry.version} | ${tagline} |`;
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
}

function clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
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

function isLocaleObject(value: any): value is App.LocalizedText {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
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
