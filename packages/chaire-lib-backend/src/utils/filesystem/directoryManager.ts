/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';
import glob from 'glob';
import util from 'util';
import fs from 'fs-extra';

import '../../config/dotenv.config';
import config from '../../config/server.config';

// Recursively get size in bytes of a file or directory
const getSize = (absolutePath: string): number => {
    const stats = fs.statSync(absolutePath);
    if (stats.isDirectory()) {
        const children = fs.readdirSync(absolutePath);
        return children
            .map((child) => getSize(path.join(absolutePath, child)))
            .reduce((cnt, current) => cnt + current, 0);
    } else {
        return stats.size;
    }
};

export class DirectoryManager {
    private _projectDirectory: string;
    private _gtfsDirectory: string;
    private _osrmDirectory: string;
    private _cacheDirectory: string;
    private _transitCacheDirectory: string;
    private _userDataDirectory: string;

    constructor(projectDirectory: string, projectShortname: string) {
        this._projectDirectory = path.normalize(`${projectDirectory}`);
        this._gtfsDirectory = path.normalize(`${this._projectDirectory}/gtfs`);
        this._osrmDirectory = path.normalize(`${this._projectDirectory}/osrm`);
        this._cacheDirectory = path.normalize(`${this._projectDirectory}/cache`);

        // we repeat the project shortname in the path to make it easier to move around and archive for trRouting:
        this._transitCacheDirectory = path.normalize(`${this._projectDirectory}/cache/transit/${projectShortname}`);
        this._userDataDirectory = path.normalize(`${this._projectDirectory}/userData`);
    }

    /**
     * Absolute path to project directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get projectDirectory() {
        return this._projectDirectory;
    }

    /**
     * Absolute path to gtfs data directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get gtfsDirectory() {
        return this._gtfsDirectory;
    }

    /**
     * Absolute path to osrm directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get osrmDirectory() {
        return this._osrmDirectory;
    }

    /**
     * Absolute path to capnp cache directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get cacheDirectory() {
        return this._cacheDirectory;
    }

    /**
     * Absolute path to transit cache directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get transitCacheDirectory() {
        return this._transitCacheDirectory;
    }

    /**
     * Absolute path to the user data directory
     *
     * @readonly
     * @memberof DirectoryManager
     */
    get userDataDirectory() {
        return this._userDataDirectory;
    }

    directoryExists(projectRelativePath: string) {
        return this.directoryExistsAbsolute(this.getAbsolutePath(projectRelativePath));
    }

    directoryExistsAbsolute(absoluteDirectoryPath: string) {
        return fs.existsSync(absoluteDirectoryPath);
    }

    getAbsolutePath(projectRelativePath: string) {
        return path.normalize(`${this.projectDirectory}/${projectRelativePath}`);
    }

    createDirectoryIfNotExists(projectRelativePath: string) {
        return this.createDirectoryIfNotExistsAbsolute(this.getAbsolutePath(projectRelativePath));
    }

    createDirectoryIfNotExistsAbsolute(absoluteDirectoryPath: string) {
        if (!fs.existsSync(absoluteDirectoryPath)) {
            fs.mkdirSync(absoluteDirectoryPath, { recursive: true });
            return absoluteDirectoryPath;
        }
        return null;
    }

    getFiles(projectRelativePath: string, includePath = false) {
        return this.getFilesAbsolute(this.getAbsolutePath(projectRelativePath), includePath);
    }

    async getFilesWithExtension(projectRelativePath: string, extension = '') {
        return this.getFilesWithExtensionAbsolute(this.getAbsolutePath(projectRelativePath), extension);
    }

    async getFilesWithExtensionAbsolute(absoluteDirectoryPath: string, extension = '') {
        const prGlob = util.promisify(glob);
        return await prGlob(`${absoluteDirectoryPath}/*.${extension}`);
    }

    getFilesAbsolute(absoluteDirectoryPath: string, includePath = false) {
        if (fs.existsSync(absoluteDirectoryPath)) {
            if (includePath) {
                return fs.readdirSync(absoluteDirectoryPath).map((fileName) => {
                    return `${absoluteDirectoryPath}/${fileName}`;
                });
            } else {
                return fs.readdirSync(absoluteDirectoryPath);
            }
        }
        return null;
    }

    // returns true if successfully copied, false if any of the two directory does not exist
    copyDirectory(
        fromProjectRelativePath: string,
        toProjectRelativePath: string,
        createDirectoriesIfNotExist = false
    ): boolean {
        return this.copyDirectoryAbsolute(
            this.getAbsolutePath(fromProjectRelativePath),
            this.getAbsolutePath(toProjectRelativePath),
            createDirectoriesIfNotExist
        );
    }

    // returns true if successfully copied, false if any of the two directory does not exist
    copyDirectoryAbsolute(fromPath: string, toPath: string, createDirectoriesIfNotExist = false): boolean {
        if (createDirectoriesIfNotExist) {
            this.createDirectoryIfNotExistsAbsolute(fromPath);
            this.createDirectoryIfNotExistsAbsolute(toPath);
        }
        if (this.directoryExistsAbsolute(fromPath) && this.directoryExistsAbsolute(toPath)) {
            fs.cpSync(fromPath, toPath, { recursive: true });
            return true;
        } else {
            return false;
        }
    }

    isEmpty(projectRelativePath: string) {
        return this.isEmptyAbsolute(this.getAbsolutePath(projectRelativePath));
    }

    isEmptyAbsolute(absoluteDirectoryPath: string) {
        if (fs.existsSync(absoluteDirectoryPath)) {
            const files = this.getFilesAbsolute(absoluteDirectoryPath);
            return files === null ? true : files.length === 0;
        }
        return null;
    }

    isNotEmpty(projectRelativePath: string) {
        const isEmpty = this.isEmpty(projectRelativePath);
        return isEmpty !== null ? !this.isEmpty(projectRelativePath) : null;
    }

    isNotEmptyAbsolute(absoluteDirectoryPath: string) {
        const isEmpty = this.isEmptyAbsolute(absoluteDirectoryPath);
        return isEmpty !== null ? !this.isEmptyAbsolute(absoluteDirectoryPath) : null;
    }

    emptyDirectory(projectRelativePath: string) {
        return this.emptyDirectoryAbsolute(this.getAbsolutePath(projectRelativePath));
    }

    emptyDirectoryAbsolute(absoluteDirectoryPath: string) {
        if (fs.existsSync(absoluteDirectoryPath)) {
            this.deleteDirectoryAbsolute(absoluteDirectoryPath);
            this.createDirectoryIfNotExistsAbsolute(absoluteDirectoryPath);
            return absoluteDirectoryPath;
        }
        return null;
    }

    deleteDirectory(projectRelativePath: string) {
        return this.deleteDirectoryAbsolute(this.getAbsolutePath(projectRelativePath));
    }

    deleteDirectoryAbsolute(absoluteDirectoryPath: string) {
        if (fs.existsSync(absoluteDirectoryPath)) {
            try {
                fs.removeSync(absoluteDirectoryPath);
            } catch (error) {
                console.error('could not delete directory', absoluteDirectoryPath, error);
            }
            return absoluteDirectoryPath;
        } else {
            return null;
        }
    }

    /**
     * Get total size, in bytes, of a directory
     *
     * @param {string} absoluteDirectoryPath Absolute path to the directory
     * @return {number} The size, in bytes
     * @memberof DirectoryManager
     */
    getDirectorySizeAbsolute(absoluteDirectoryPath: string): number {
        const size = getSize(absoluteDirectoryPath);
        return size;
    }
}

// singleton:
export const directoryManager = new DirectoryManager(config.projectDirectory, config.projectShortname || '');
Object.freeze(directoryManager);
