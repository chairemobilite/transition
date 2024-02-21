/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import os from 'os';
import { directoryManager } from '../filesystem/directoryManager';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import ProcessManager from './ProcessManager';
import osrmService from '../osrm/OSRMService';
import config from '../../config/server.config';

// Set 2 threads as default, just in case we have more than one request being handled
const DEFAULT_THREAD_COUNT = 2;

const getServiceName = function (port) {
    return `trRouting${port}`;
};

const startTrRoutingProcess = async (
    port: number,
    attemptRestart = false,
    threadCount = 1,
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
        commandArgs.push(`--cachePath=${directoryManager.projectDirectory}/cache/${config.projectShortname}`);
    }

    // Set the threads argment if we have a threadCount param and it's higher than one
    if (threadCount && threadCount > 1) {
        commandArgs.push(`--threads=${threadCount}`);
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
    return await startTrRoutingProcess(port, false, DEFAULT_THREAD_COUNT, parameters);
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
        return await startTrRoutingProcess(port, true, DEFAULT_THREAD_COUNT, parameters);
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

const startBatch = async function (
    numberOfCpus: number,
    port: number = Preferences.get('trRouting.batchPortStart', 14000),
    cacheDirectoryPath?: string
) {
    // Ensure we don't use more CPU than configured
    // TODO The os.cpus().length should move to a "default config management class"
    const maxThreadCount = config.maxParallelCalculators || os.cpus().length;
    if (numberOfCpus > maxThreadCount) {
        console.warn('Asking for too many trRouting threads (%d), reducing to %d', numberOfCpus, maxThreadCount);
        numberOfCpus = maxThreadCount;
    }

    const params = { cacheDirectoryPath: cacheDirectoryPath };

    await startTrRoutingProcess(port, false, numberOfCpus, params);

    return {
        status: 'started',
        service: 'trRoutingBatch',
        port: port
    };
};

const stopBatch = async function (port = Preferences.get('trRouting.batchPortStart', 14000)) {
    await stop({ port: port });

    return {
        status: 'stopped',
        service: 'trRoutingBatch',
        port: port
    };
};

export default {
    start,
    stop,
    restart,
    status,
    startBatch,
    stopBatch
};
