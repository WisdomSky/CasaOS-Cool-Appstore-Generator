import fs from "fs";
import path from 'path'
import crypto from 'crypto';

export default class Utils {
    static createDir(...paths: string[]) {
        for (const dir of paths) {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive: true});
        }
    }

    static removeDir(dir: string) {
        if (fs.existsSync(dir)) fs.rmSync(dir, {recursive: true, force: true});
    }

    static copyDir(sourceDir, destinationDir, excludeFilenames: string[] = []) {
        // Create destination directory if it doesn't exist
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, {recursive: true});
        }

        // Read the contents of the source directory
        const files = fs.readdirSync(sourceDir);

        // Iterate over each file/directory in the source directory
        files.forEach((file) => {
            const sourcePath = path.join(sourceDir, file);
            const destinationPath = path.join(destinationDir, file);

            // Check if the current item is a directory
            if (fs.statSync(sourcePath).isDirectory()) {
                // Recursively copy the directory
                Utils.copyDir(sourcePath, destinationPath, excludeFilenames);
            } else {
                // Copy the file
                if (excludeFilenames.indexOf(file) === -1) {
                    fs.copyFileSync(sourcePath, destinationPath);
                }
            }
        });
    }

    static normalizeBaseUrl(baseUrl: string = ''): string {
        return String(baseUrl || '').trim().replace(/\/+$/, '');
    }

    static urlJoin(baseUrl: string, relativePath: string): string {
        const normalizedBase = Utils.normalizeBaseUrl(baseUrl);
        const normalizedPath = `/${String(relativePath || '').replace(/^\/+/, '')}`;

        return normalizedBase.length === 0 ? normalizedPath : `${normalizedBase}${normalizedPath}`;
    }

    static listFiles(dir: string): string[] {
        if (!fs.existsSync(dir)) return [];

        const files: string[] = [];
        for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
            const entryPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files.push(...Utils.listFiles(entryPath));
            } else if (entry.isFile()) {
                files.push(entryPath);
            }
        }

        return files.sort();
    }

    static hashDirectory(dir: string): string {
        const hash = crypto.createHash('sha256');

        for (const file of Utils.listFiles(dir)) {
            const relative = path.relative(dir, file).split(path.sep).join('/');
            hash.update(relative);
            hash.update(Buffer.from([0]));
            hash.update(fs.readFileSync(file));
            hash.update(Buffer.from([0]));
        }

        return hash.digest('hex').substring(0, 8);
    }

    static readJson<T>(file: string): T {
        return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    }

    static writeJson(file: string, data: any): void {
        Utils.createDir(path.dirname(file));
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    }
}
