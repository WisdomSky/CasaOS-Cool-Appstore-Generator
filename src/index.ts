import 'dotenv/config'
import StoreBuilder from "./classes/store";
import Log, {LogLevel} from "./classes/log";
import Utils from "./classes/utils";

function getArgument(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) return undefined;

    return process.argv[index + 1];
}

const args = process.argv.slice(2);
const validateOnly = args.includes('--validate-only') || args.includes('--validate');
const skipTagUpdate = validateOnly || args.includes('--skip-tag-update');
const outputDir = getArgument('--output') || 'dist';
const baseUrl = getArgument('--base-url') ?? process.env.BASE_URL ?? 'https://cdn.jsdelivr.net/gh/WisdomSky/CasaOS-Coolstore@gh-pages';

Log.setLogLevel(LogLevel.Info);

const store = new StoreBuilder();
store.load();

let validation = store.validate();
if (validation.errors.length > 0) {
    for (const error of validation.errors) Log.error(`ERROR ${error}`);
    for (const warning of validation.warnings) Log.error(`WARN  ${warning}`);
    process.exit(1);
}

if (!skipTagUpdate) {
    Log.info('Resolving image tags...');
    await store.updateTags();
}

validation = store.validate();
if (validation.errors.length > 0) {
    for (const error of validation.errors) Log.error(`ERROR ${error}`);
    for (const warning of validation.warnings) Log.error(`WARN  ${warning}`);
    process.exit(1);
}

if (validateOnly) {
    for (const warning of validation.warnings) Log.error(`WARN  ${warning}`);
    Log.info(`Validation passed for ${store.appCount()} app(s).`);
    process.exit(0);
}

await store.build(outputDir, baseUrl);

const storeUrl = Utils.urlJoin(baseUrl, 'store.json');
Log.info(`AppStore v2 source generated in ${outputDir}`);
Log.info(`Published store URL: ${storeUrl}`);
