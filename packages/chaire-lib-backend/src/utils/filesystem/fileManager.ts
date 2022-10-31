/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import { DirectoryManager, directoryManager } from './directoryManager';

class FileManager {
    private _directoryManager: DirectoryManager;

    constructor() {
        this._directoryManager = directoryManager;
    }

    get directoryManager() {
        return this._directoryManager;
    }

    getFileName(projectRelativeFilePath: string) {
        return this.getFileNameAbsolute(this.getAbsolutePath(projectRelativeFilePath));
    }

    getFileNameAbsolute(absoluteFilePath: string) {
        return path.basename(absoluteFilePath);
    }

    // create the directory path (recursive) for the file if not exists and return the absolute path:
    setupFile(projectRelativeFilePath: string) {
        if (this.directoryManager.createDirectoryIfNotExists(path.dirname(projectRelativeFilePath)) !== null) {
            return this.getAbsolutePath(projectRelativeFilePath);
        }
        return null;
    }

    // create the directory path (recursive) for the absolute file path if not exists and return the (absolute) path:
    setupFileAbsolute(absoluteFilePath: string) {
        if (this.directoryManager.createDirectoryIfNotExistsAbsolute(path.dirname(absoluteFilePath)) !== null) {
            return absoluteFilePath;
        }
        return null;
    }

    getAbsolutePath(projectRelativeFilePath: string) {
        return path.normalize(`${this.directoryManager.projectDirectory}/${projectRelativeFilePath}`);
    }

    writeFile(projectRelativeFilePath: string, content: any, options = { flag: 'w' }) {
        return this.writeFileAbsolute(this.getAbsolutePath(projectRelativeFilePath), content, options);
    }

    writeFileAbsolute(absoluteFilePath: string, content: any, options = { flag: 'w' }) {
        if (fs.existsSync(path.dirname(absoluteFilePath))) {
            fs.writeFileSync(absoluteFilePath, content, options);
            return absoluteFilePath;
        } else {
            console.error(`FileManager: directory does not exists for file path: ${absoluteFilePath}`);
        }
        return null;
    }

    appendFile(projectRelativeFilePath: string, content: any) {
        return this.writeFile(projectRelativeFilePath, content, { flag: 'a' });
    }

    appendFileAbsolute(absoluteFilePath: string, content: any) {
        return this.writeFileAbsolute(absoluteFilePath, content, { flag: 'a' });
    }

    readFile(projectRelativeFilePath: string) {
        return this.readFileAbsolute(this.getAbsolutePath(projectRelativeFilePath));
    }

    readFileAbsolute(absoluteFilePath: string) {
        if (fs.existsSync(absoluteFilePath)) {
            return fs.readFileSync(absoluteFilePath).toString();
        }
        return null;
    }

    truncateFile(projectRelativeFilePath: string) {
        return this.truncateFileAbsolute(this.getAbsolutePath(projectRelativeFilePath));
    }

    truncateFileAbsolute(absoluteFilePath: string) {
        if (fs.existsSync(absoluteFilePath)) {
            fs.truncateSync(absoluteFilePath);
            return absoluteFilePath;
        }
        return null;
    }

    // returns true if successfully copied, false if the from file does not exist, or if the to directory does not exist
    copyFile(
        fromProjectRelativeFilePath: string,
        toProjectRelativeFilePath: string,
        createToDirectoryIfNotExist = false
    ): boolean {
        return this.copyFileAbsolute(
            this.getAbsolutePath(fromProjectRelativeFilePath),
            this.getAbsolutePath(toProjectRelativeFilePath),
            createToDirectoryIfNotExist
        );
    }

    // returns true if successfully copied, false if the from file does not exist, or if the to directory does not exist
    copyFileAbsolute(fromFilePath: string, toFilePath: string, createToDirectoryIfNotExist = false): boolean {
        if (createToDirectoryIfNotExist) {
            this.directoryManager.createDirectoryIfNotExistsAbsolute(path.dirname(toFilePath));
        }

        if (
            this.fileExistsAbsolute(fromFilePath) &&
            this.directoryManager.directoryExistsAbsolute(path.dirname(toFilePath))
        ) {
            fs.copyFileSync(fromFilePath, toFilePath);
            return true;
        } else {
            return false;
        }
    }

    fileExists(projectRelativeFilePath: string) {
        return fs.existsSync(this.getAbsolutePath(projectRelativeFilePath));
    }

    fileExistsAbsolute(absoluteFilePath: string) {
        return fs.existsSync(absoluteFilePath);
    }

    deleteFile(projectRelativeFilePath: string) {
        return this.deleteFileAbsolute(this.getAbsolutePath(projectRelativeFilePath));
    }

    deleteFileAbsolute(absoluteFilePath: string) {
        if (fs.existsSync(absoluteFilePath)) {
            fs.unlinkSync(absoluteFilePath);
            return absoluteFilePath;
        }
        return null;
    }
}

// singleton:
export const fileManager = new FileManager();
Object.freeze(fileManager);
