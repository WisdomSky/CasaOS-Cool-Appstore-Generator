import fs from 'fs'
import App from "./app";
import path from "path";

export default class Apps implements Iterable<App> {
    private readonly apps: App[] = [];
    constructor() {
        try {
            const appsDir = path.resolve('src/apps');

            const files = fs.readdirSync(appsDir, { withFileTypes: true });

            const directories = files.filter(file => file.isDirectory());

            this.apps = directories.map(({ name }) => {
                return new App(path.resolve(appsDir, name));
            });
        } catch (err) {
            console.error('Error reading directory:', err);
        }
    }

    list(): App[] {
        return this.apps;
    }

    each(callback: (app: App, index: number, arr: App[]) => void): void {
        this.apps.forEach(callback);
    }

    public *[Symbol.iterator](): IterableIterator<App> {
        let i = 0;
        while (i < this.apps.length) {
            yield this.apps[i]; i++;
        }
    }

}