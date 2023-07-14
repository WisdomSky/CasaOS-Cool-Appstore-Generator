import fs from "fs";
import path from 'path'
import {Response} from "node-fetch";
import Log from "./log";

export default class Utils {
    static createDir(...paths) {
        for (const dir of arguments) {
            if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        }
    }

    static copyDir(sourceDir, destinationDir, excludeFilenames: string[] = []) {
        // Create destination directory if it doesn't exist
        if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir);
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
                Utils.copyDir(sourcePath, destinationPath);
            } else {
                // Copy the file
                if (excludeFilenames.indexOf(file) === -1) {
                    fs.copyFileSync(sourcePath, destinationPath);
                }
            }
        });
    }


}