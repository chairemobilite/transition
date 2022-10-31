/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import i18next from 'i18next';
import Backend from 'i18next-fs-backend';
import { join } from 'path';

import config from './server.config';
import { fileManager } from '../utils/filesystem/fileManager';
import { directoryManager } from '../utils/filesystem/directoryManager';

// See if there are translation files for language and namespace in the registered directories
const getTranslationPath = (lng: string, namespace: string) => {
    if (translationPaths.length === 0) {
        console.warn('No translation path specified');
    }
    for (let i = 0; i < translationPaths.length; i++) {
        const translationPath = translationPaths[i];
        if (fileManager.fileExistsAbsolute(`${translationPath}/${lng}/${namespace}.yml`)) {
            return `${translationPath}/{{lng}}/{{ns}}.yml`;
        } else if (fileManager.fileExistsAbsolute(`${translationPath}/${lng}/${namespace}.json`)) {
            return `${translationPath}/{{lng}}/{{ns}}.json`;
        }
    }
    return '/locales/{{lng}}/{{ns}}.json';
};

const translationPaths: string[] = [];
/**
 * Register a directory where translation files are located. Note that this
 * should be called before the i18n is first used by the server, otherwise, it
 * won't be used.
 *
 * @param dir Directory, absolute or relative, where the locales files are. This
 * directory should contain one directory per locale, with the translations
 * files in it.
 */
export const registerTranslationDir = (dir: string) => {
    if (fileManager.fileExists(dir) && directoryManager.isNotEmpty(dir)) {
        translationPaths.push(fileManager.getAbsolutePath(dir));
    } else if (fileManager.fileExistsAbsolute(dir) && directoryManager.isNotEmptyAbsolute(dir)) {
        translationPaths.push(dir);
    } else {
        console.log(`i18next directory to register is empty or not a directory: ${dir}`);
    }
};

const namespaces = ['server', 'main'];
/**
 * Add a translation namespace to the translation object. Note that this should
 * be called before the i18n is first used by the server, otherwise, it won't be
 * used.
 *
 * @param ns The namespace to add
 */
export const addTranslationNamespace = (ns: string) => {
    if (!namespaces.includes(ns)) {
        namespaces.push(ns);
    }
};

let initialized = false;
const initializeI18n = () => {
    i18next.use(Backend).init({
        initImmediate: false,
        load: 'languageOnly', // no region-specific,
        supportedLngs: config.languages,
        preload: config.languages,
        nonExplicitSupportedLngs: false,
        fallbackLng: config.defaultLocale || 'en',
        ns: namespaces,
        defaultNS: 'server',
        debug: false,
        backend: {
            loadPath: getTranslationPath,
            addPath: join(__dirname, '../../../../../locales/{{lng}}/{{ns}}.missing.json')
        }
    });
    initialized = true;
};

const getI18n = () => {
    if (!initialized) {
        initializeI18n();
    }
    return i18next;
};

export default getI18n;
