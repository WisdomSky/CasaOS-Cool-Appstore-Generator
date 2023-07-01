import Apps from "./classes/apps";
import Appdater from "./classes/appdater";
import Utils from "./classes/utils";
import path from 'path'
import Log, { LogLevel } from "./classes/log";


// create dist directory
Utils.createDir('dist');
Utils.createDir(path.join('dist', 'Apps'));

// copy assets dir into the dist directory
Utils.copyDir('src/assets', 'dist/assets');

for (const app of new Apps()) {

    const updater = new Appdater(app);

    // verbose output
    Log.setLogLevel(LogLevel.Silent);

    // execute tag updater
    await updater.updateTag();

    // create dist app directory
    const distAppPath = path.join('dist', 'Apps', app.name());
    Utils.createDir(distAppPath);

    // copy the source app into the dist app directory
    Utils.copyDir(app.getPath(), distAppPath, ['config.js']);

    // overwrite the docker-compose file inside the dist app directory
    app.compose().writeToFile(path.resolve(distAppPath, app.getComposeFilename()));

}


