/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { directoryManager } from '../filesystem/directoryManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ProcessManager from './ProcessManager';
import osrmService from '../osrm/OSRMService';
import { projectConfig } from '../../config/config';

const availablePortsByStartingPort: { [startingPort: number]: { [port: number]: boolean } } = {};

const getServiceName = function (port) {
    return `trRouting${port}`;
};

const startTrRoutingProcess = async (
    port: number,
    attemptRestart = false,
    parameters: { debug?: boolean; cacheDirectoryPath?: string } = { debug: false, cacheDirectoryPath: undefined }
) => {
    const osrmWalkingServerInfo = osrmService.getMode('walking').getHostPort();
    const serviceName = getServiceName(port);
    const tagName = 'trRouting';

    const [command, cwd] =
        process.env.TR_ROUTING_PATH !== undefined
            ? ['./trRouting', process.env.TR_ROUTING_PATH]
            : ['trRouting', undefined];
    const commandArgs = [
        // FIXME Extract to constant the 'cache/' part of the directory somewhere
        `--port=${port}`,
        `--osrmPort=${osrmWalkingServerInfo.port}`,
        `--osrmHost=${osrmWalkingServerInfo.host}`,
        `--debug=${parameters.debug === true ? 1 : 0}`
    ];
    if (parameters.cacheDirectoryPath) {
        commandArgs.push(`--cachePath=${parameters.cacheDirectoryPath}`);
    } else {
        commandArgs.push(`--cachePath=${directoryManager.projectDirectory}/cache/${projectConfig.projectShortname}`);
    }
    const waitString = 'ready.';

    const processStatus = await ProcessManager.startProcess(
        serviceName,
        tagName,
        command,
        commandArgs,
        waitString,
        false,
        cwd,
        attemptRestart
    );
    if (processStatus.status === 'error' && processStatus.error.code === 'ENOENT') {
        console.error(
            `trRouting executable does not exist in path ${
                process.env.TR_ROUTING_PATH === undefined ? process.env.PATH : process.env.TR_ROUTING_PATH
            }`
        );
    }
    return processStatus;
};

const start = async (parameters: { port?: number; debug?: boolean; cacheDirectoryPath?: string }) => {
    const port = parameters.port || Preferences.get('trRouting.port');

    // TODO Check why we need this await, should not be useful before returning
    return await startTrRoutingProcess(port, undefined, parameters);
};

const stop = async (parameters) => {
    const port = parameters.port || Preferences.get('trRouting.port');
    const serviceName = getServiceName(port);
    const tagName = 'trRouting';

    return await ProcessManager.stopProcess(serviceName, tagName);
};

const restart = async (parameters) => {
    const port = parameters.port || Preferences.get('trRouting.port');
    const serviceName = getServiceName(port);

    if (parameters.doNotStartIfStopped && !(await ProcessManager.isServiceRunning(serviceName))) {
        console.log('trRouting was not running and does not need to be started');

        return {
            status: 'no_restart_required',
            service: 'trRouting',
            name: serviceName
        };
    } else {
        // TODO Check why we need this await, should be be useful before returning
        return await startTrRoutingProcess(port, true, parameters);
    }
};

const status = async (parameters) => {
    const port = parameters.port || Preferences.get('trRouting.port');
    const serviceName = getServiceName(port);

    if (await ProcessManager.isServiceRunning(serviceName)) {
        return {
            status: 'started',
            service: 'trRouting',
            name: serviceName
        };
    } else {
        return {
            status: 'not_running',
            service: 'trRouting',
            name: serviceName
        };
    }
};

const startMultiple = async function (
    numberOfInstances: number,
    startingPort = Preferences.get('trRouting.batchPortStart', 14000),
    cacheDirectoryPath?: string
) {
    for (let i = 0; i < numberOfInstances; i++) {
        const params: { [key: string]: number | string | boolean } = {
            port: startingPort + i
        };
        if (cacheDirectoryPath) {
            params.cacheDirectoryPath = cacheDirectoryPath;
        }
        await start(params);
        if (!availablePortsByStartingPort[startingPort]) {
            availablePortsByStartingPort[startingPort] = {};
        }
        availablePortsByStartingPort[startingPort][startingPort + i] = true;
    }
    return {
        status: 'started',
        service: 'trRoutingMultiple',
        startingPort: startingPort
    };
};

const stopMultiple = async function (
    numberOfInstances,
    startingPort = Preferences.get('trRouting.batchPortStart', 14000)
) {
    for (let i = 0; i < numberOfInstances; i++) {
        await stop({
            port: startingPort + i
        });
        if (
            availablePortsByStartingPort[startingPort] &&
            availablePortsByStartingPort[startingPort][startingPort + i]
        ) {
            delete availablePortsByStartingPort[startingPort][startingPort + i];
        }
    }
    return {
        status: 'stopped',
        service: 'trRoutingMultiple',
        startingPort: startingPort
    };
};

const getAvailablePortsByStartingPort = function (startingPort = Preferences.get('trRouting.batchPortStart', 14000)) {
    return availablePortsByStartingPort[startingPort] || [];
};

const getAvailablePort = function (startingPort = Preferences.get('trRouting.batchPortStart', 14000)) {
    if (!availablePortsByStartingPort[startingPort]) {
        return null;
    }
    for (const port in availablePortsByStartingPort[startingPort]) {
        if (availablePortsByStartingPort[startingPort][port] === true) {
            return port;
        }
    }
    return null;
};

export default {
    start,
    stop,
    restart,
    status,
    startMultiple,
    stopMultiple,
    getAvailablePortsByStartingPort,
    availablePortsByStartingPort,
    getAvailablePort
};
