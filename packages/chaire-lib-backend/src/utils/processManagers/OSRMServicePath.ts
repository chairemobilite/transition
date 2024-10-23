/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { fileManager } from '../filesystem/fileManager';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

const defaultDirectoryPrefix = process.env.OSRM_DIRECTORY_PREFIX
    ? process.env.OSRM_DIRECTORY_PREFIX
    : // TODO: Migrate this value from preferences to config like the osrm modes. See issue #1140
    Preferences.get('osrmRouting.directoryPrefix', '');

const getDirectoryPrefix = function (directoryPrefix = defaultDirectoryPrefix) {
    return !_isBlank(directoryPrefix) ? directoryPrefix + '_' : '';
};

const getOsrmDirectoryPathForMode = function (mode: RoutingMode, directoryPrefix = defaultDirectoryPrefix) {
    const directoryPrefixPrefix = getDirectoryPrefix(directoryPrefix);
    let osrmDirectoryPath = `osrm/${directoryPrefixPrefix}${mode}`;

    // accept walk/foot, bicycle and car instead of walking/cycling/driving:
    if (
        mode === 'walking' &&
        !fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}walking`) &&
        fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}walk`)
    ) {
        osrmDirectoryPath = `osrm/${directoryPrefixPrefix}walk`;
    } else if (
        mode === 'walking' &&
        !fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}walking`) &&
        fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}foot`)
    ) {
        osrmDirectoryPath = `osrm/${directoryPrefixPrefix}walk`;
    } else if (
        mode === 'cycling' &&
        !fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}cycling`) &&
        fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}bicycle`)
    ) {
        osrmDirectoryPath = `osrm/${directoryPrefixPrefix}bicycle`;
    } else if (
        mode === 'driving' &&
        !fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}driving`) &&
        fileManager.directoryManager.directoryExists(`osrm/${directoryPrefixPrefix}car`)
    ) {
        osrmDirectoryPath = `osrm/${directoryPrefixPrefix}car`;
    }

    return fileManager.directoryManager.getAbsolutePath(osrmDirectoryPath);
};

export { defaultDirectoryPrefix, getDirectoryPrefix, getOsrmDirectoryPathForMode };
