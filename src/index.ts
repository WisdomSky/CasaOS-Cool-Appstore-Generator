import Apps from "./classes/apps";
import Appdater from "./classes/appdater";
import Utils from "./classes/utils";
import path from 'path'
import Log, { LogLevel } from "./classes/log";
import fs from "fs";
import GithubRepositoryHandler from "./classes/handlers/github";


// create dist directory
Utils.createDir('dist');
Utils.createDir(path.join('dist', 'Apps'));

// copy assets dir into the dist directory
Utils.copyDir('src/assets', 'dist');


let appsListMd = [
    `| Application  | Version | Project Page |`,
    `| --- | --- | --- |`
];

for (const app of new Apps()) {

    const updater = new Appdater(app);

    // verbose output
    Log.setLogLevel(LogLevel.Info);

    // execute tag updater
    await updater.updateTag();

    // create dist app directory
    const distAppPath = path.join('dist', 'Apps', app.name());
    Utils.createDir(distAppPath);

    // copy the source app into the dist app directory
    Utils.copyDir(app.getPath(), distAppPath, ['config.js']);

    // overwrite the docker-compose file inside the dist app directory
    app.compose().writeToFile(path.resolve(distAppPath, app.getComposeFilename()));


    // app's project page url
    let projectPage = app.compose()['x-casaos'].project_url;
    if (projectPage === undefined) {
        if (app.image().indexOf('/') === -1) {
            projectPage = `https://hub.docker.com/_/${app.image()}`;
        } else {
            projectPage = `https://hub.docker.com/r/${app.image()}`;
        }
    }

    // app's icon url
    let icon = app.compose()['x-casaos'].icon;
    if (icon === undefined || icon.trim().length === 0) {
        icon = 'https://cdn.jsdelivr.net/gh/WisdomSky/CasaOS-Coolstore@main/default-icon.svg';
    }

    // app's name
    let title = app.compose()["x-casaos"].title.en_us;

    appsListMd.push(`| <img src="${icon}" width="15"/>&nbsp;&nbsp;&nbsp;[${title}](https://github.com/WisdomSky/CasaOS-Coolstore/tree/main/Apps/${app.name()}) | ${app.tag()} | ${projectPage} |`);

}

// populate app's list in Readme.md
let readme = fs.readFileSync('src/assets/README.md', 'utf8');

readme = readme.replace('%APPSLIST%', appsListMd.join("\n"));

fs.writeFileSync(path.join('dist', 'README.md'), readme);

