/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

import { fileManager } from '../filesystem/fileManager';
import { getOsrmDirectoryPathForMode, defaultDirectoryPrefix, getDirectoryPrefix } from './OSRMServicePath';
import { RoutingMode } from 'chaire-lib-common/lib/config/routingModes';

type OSRMResult = {
    status: 'extracted' | 'contracted' | 'prepared' | 'error';
    service: 'osrm';
    action: string;
    mode?: RoutingMode;
    logFile?: string;
    error?: string | Error | unknown;
};

type OSRMPrepareResult = OSRMResult & {
    modes?: RoutingMode[];
};

type OSRMExtractParameters = {
    osmFilePath: string;
    directoryPrefix?: string;
    mode?: RoutingMode;
};

type OSRMContractParameters = {
    mode?: RoutingMode;
    directoryPrefix?: string;
};

const extract = function (params: OSRMExtractParameters): Promise<OSRMResult> {
    const { osmFilePath, directoryPrefix, mode = 'walking' } = params;

    const fileExtension = path.extname(osmFilePath);
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, directoryPrefix);
    const osrmFileName = getDirectoryPrefix(directoryPrefix);
    const movedFilePath = `${osrmDirectoryPath}/${osrmFileName}${mode}${fileExtension}`;
    const profileFileName = `${mode}.lua`;

    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(osrmDirectoryPath);

    return new Promise((resolve, _reject) => {
        console.log(`osrm: extracting osm data for mode ${mode} from file ${osmFilePath}`);

        try {
            fs.copyFileSync(osmFilePath, movedFilePath);
        } catch (error) {
            console.error(`CopyFileSync: ${error}`);
            resolve({
                status: 'error',
                service: 'osrm',
                action: 'extract',
                mode,
                error
            });
        }

        console.log(`osrm-extract --profile="${__dirname}/osrmProfiles/${profileFileName}" "${movedFilePath}"`);
        // TODO: Allow to override the osrm profiles file from the application
        const osrmProcess = spawn(
            'osrm-extract',
            [`--profile="${__dirname}/osrmProfiles/${profileFileName}" `, `"${movedFilePath}"`],
            {
                shell: true,
                detached: false
            }
        );

        osrmProcess.stdout.on('data', (data) => {
            if (data.toString().includes('[info] To prepare the data for routing, run:')) {
                console.log(`osrm extracted data from osm file ${movedFilePath}`);
                resolve({
                    status: 'extracted',
                    service: 'osrm',
                    action: 'extract',
                    mode
                });
            }
        });

        osrmProcess.stderr.on('data', (data) => {
            const error = data.toString();
            if (error.startsWith('[error]')) {
                console.error(`stderr: ${error}`);
                resolve({
                    status: 'error',
                    service: 'osrm',
                    action: 'extract',
                    mode,
                    error
                });
            }
        });

        osrmProcess.on('exit', (code, signal) => {
            if (!(code === 0 && signal === null)) {
                // failed
                const error = `osrm contract for mode ${mode} exited with code ${code} and signal ${signal}`;
                console.error(error);
                resolve({
                    status: 'error',
                    service: 'osrm',
                    action: 'extract',
                    mode,
                    error
                });
            }
        });

        osrmProcess.on('error', (error) => {
            console.log(`osrm extract for mode ${mode} sent error: ${error}`);
            resolve({
                status: 'error',
                service: 'osrm',
                action: 'extract',
                mode,
                error
            });
        });
    });
};

const contract = function (params: OSRMContractParameters): Promise<OSRMResult> {
    const { mode = 'walking', directoryPrefix } = params;
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, directoryPrefix);

    return new Promise((resolve, _reject) => {
        console.log(`osrm: contracting osrm data for mode ${mode} from directory ${osrmDirectoryPath}`);

        // contract parameter need to match the prefix of the osm file passed to extract
        // in our case it's the mode name. The .osrm is not generated in the latest osrm-extract
        // but the name is still accepted as a base path
        const osrmProcess = spawn('osrm-contract', [`${mode}.osrm`], {
            shell: true,
            detached: false,
            cwd: osrmDirectoryPath
        });

        osrmProcess.stdout.on('data', (data) => {
            if (data.toString().includes('[info] finished preprocessing')) {
                //console.log(`osrm contracted data from osrm directory ${osrmDirectoryPath}`);
                resolve({
                    status: 'contracted',
                    service: 'osrm',
                    action: 'contract',
                    mode
                });
            }
        });

        osrmProcess.stderr.on('data', (data) => {
            const error = data.toString();
            if (error.startsWith('[error]')) {
                console.error(error);
                resolve({
                    status: 'error',
                    service: 'osrm',
                    action: 'contract',
                    mode,
                    error
                });
            }
        });

        osrmProcess.on('exit', (code, signal) => {
            if (!(code === 0 && signal === null)) {
                // failed
                const error = `osrm contract for mode ${mode} exited with code ${code} and signal ${signal}`;
                console.error(error);
                resolve({
                    status: 'error',
                    service: 'osrm',
                    action: 'contract',
                    mode,
                    error
                });
            }
        });

        osrmProcess.on('error', (error) => {
            console.error(`osrm contract for mode ${mode} sent error: ${error}`);
            resolve({
                status: 'error',
                service: 'osrm',
                action: 'contract',
                mode,
                error
            });
        });
    });
};

const prepare = async function (
    osmFilePath: string,
    modes: RoutingMode[] | RoutingMode = ['walking', 'cycling', 'driving', 'bus_urban', 'bus_suburb'],
    directoryPrefix = defaultDirectoryPrefix
): Promise<OSRMPrepareResult> {
    if (!Array.isArray(modes)) {
        modes = [modes];
    }

    for (let i = 0, countI = modes.length; i < countI; i++) {
        const mode = modes[i];
        const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, directoryPrefix);
        fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(osrmDirectoryPath);

        const extractResult = await extract({ osmFilePath, mode, directoryPrefix });
        if (extractResult.status !== 'extracted') {
            return {
                status: 'error',
                service: 'osrm',
                action: 'prepare.extract',
                error: extractResult.error,
                modes
            };
        }

        const contractResult = await contract({ mode, directoryPrefix });
        if (contractResult.status !== 'contracted') {
            return {
                status: 'error',
                service: 'osrm',
                action: 'prepare.contract',
                error: contractResult.error,
                modes
            };
        }
    }

    console.log(`osrm data for modes ${modes.join(',')} is ready for routing.`);
    return {
        status: 'prepared',
        service: 'osrm',
        action: 'prepare',
        modes
    };
};

export default {
    extract,
    contract,
    prepare
};
