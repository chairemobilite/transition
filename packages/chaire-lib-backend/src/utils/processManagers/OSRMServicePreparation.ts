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

const defaultImportOsmFilePath = fileManager.directoryManager.getAbsolutePath('imports/network.osm');

//TODO set type for parameters instead of any
//TODO set type for Promise return (in all the file)
const extract = function(parameters = {} as any): Promise<any> {
    const osmFilePath = parameters.osmFilePath || defaultImportOsmFilePath;
    const fileExtension = path.extname(osmFilePath);
    //console.log(osmFilePath, fileExtension);
    const mode = parameters.mode || 'walking';
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, parameters.directoryPrefix);
    const osrmFileName = getDirectoryPrefix(parameters.directoryPrefix);
    const movedFilePath = `${osrmDirectoryPath}/${osrmFileName}${mode}${fileExtension}`;
    const profileFileName = `${mode}.lua`;

    fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(osrmDirectoryPath);

    return new Promise((resolve, reject) => {
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
        // TODO Allow to override the osrm profiles file from the application
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

//TODO set type for parameters instead of any
const contract = function(parameters = {} as any): Promise<any> {
    const mode = parameters.mode || 'walking';
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, parameters.directoryPrefix);

    return new Promise((resolve, reject) => {
        console.log(`osrm: contracting osrm data for mode ${mode} from directory ${osrmDirectoryPath}`);

        const osrmProcess = spawn('osrm-contract', ['*.osrm'], {
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

const prepare = async function(
    modes: RoutingMode[] | RoutingMode = ['walking', 'cycling', 'driving', 'bus_urban', 'bus_suburb'],
    osmFilePath = defaultImportOsmFilePath,
    directoryPrefix = defaultDirectoryPrefix
): Promise<any> {
    if (!Array.isArray(modes)) {
        modes = [modes];
    }

    for (let i = 0, countI = modes.length; i < countI; i++) {
        const mode = modes[i];
        const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, directoryPrefix);
        fileManager.directoryManager.createDirectoryIfNotExistsAbsolute(osrmDirectoryPath);

        const extractResult = await extract({
            mode: mode,
            osmFilePath: osmFilePath,
            directoryPrefix
        });
        if (extractResult.status !== 'extracted') {
            return {
                status: 'error',
                service: 'osrm',
                action: 'prepare.extract',
                error: extractResult.error,
                modes
            };
        }

        const contractResult = await contract({
            mode: mode,
            directoryPrefix
        });
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
