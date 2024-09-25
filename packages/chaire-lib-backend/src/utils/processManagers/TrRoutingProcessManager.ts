/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import os from 'os';
import { directoryManager } from '../filesystem/directoryManager';
import ProcessManager from './ProcessManager';
import osrmService from '../osrm/OSRMService';
import config from '../../config/server.config';
import serverConfig from '../../config/ServerConfig';

// Set 2 threads as default, just in case we have more than one request being handled
const DEFAULT_THREAD_COUNT = 2;

// Type for the parameters to start the trRouting process, so all start
// functions use the same
type TrRoutingStartParameters = {
    port?: number;
    debug?: boolean;
    cacheDirectoryPath?: string;
};

const getServiceName = function (port: number) {
    return `trRouting${port}`;
};

const startTrRoutingProcess = async (
    port: number,
    attemptRestart = false,
    threadCount = 1,
    {
        debug = false,
        cacheDirectoryPath,
        cacheAllScenarios = false
    }: {
        debug?: boolean;
        cacheDirectoryPath?: string;
        cacheAllScenarios?: boolean; // Flag to enable the trRouting connection cache for all scenario
    }
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
        `--debug=${debug === true ? 1 : 0}`
    ];
    if (cacheDirectoryPath) {
        commandArgs.push(`--cachePath=${cacheDirectoryPath}`);
    } else {
        commandArgs.push(`--cachePath=${directoryManager.projectDirectory}/cache/${config.projectShortname}`);
    }

    // Set the threads argment if we have a threadCount param and it's higher than one
    if (threadCount && threadCount > 1) {
        commandArgs.push(`--threads=${threadCount}`);
    }

    // Enable the caching of all scenario. This consume lot of memory, so it's disabled by default
    if (cacheAllScenarios) {
        commandArgs.push('--cacheAllConnectionSets=true');
    }

    const waitString = 'ready.';

    const processStatus = await ProcessManager.startProcess({
        serviceName,
        tagName,
        command,
        commandArgs,
        waitString,
        useShell: false,
        cwd,
        attemptRestart
    });
    if (processStatus.status === 'error' && processStatus.error.code === 'ENOENT') {
        console.error(
            `trRouting executable does not exist in path ${
                process.env.TR_ROUTING_PATH === undefined ? process.env.PATH : process.env.TR_ROUTING_PATH
            }`
        );
    }
    return processStatus;
};

const start = async (parameters: TrRoutingStartParameters) => {
    const trRoutingSingleConfig = serverConfig.getTrRoutingConfig('single');
    const port = parameters.port || trRoutingSingleConfig.port;
    const cacheAllScenarios = trRoutingSingleConfig.cacheAllScenarios;

    const params: Parameters<typeof startTrRoutingProcess>[3] = {
        debug: parameters.debug,
        cacheDirectoryPath: parameters.cacheDirectoryPath,
        cacheAllScenarios: cacheAllScenarios
    };

    // TODO Check why we need this await, should not be useful before returning
    return await startTrRoutingProcess(port, false, DEFAULT_THREAD_COUNT, params);
};

const stop = async (parameters: { port?: number; debug?: boolean; cacheDirectoryPath?: string }) => {
    const trRoutingSingleConfig = serverConfig.getTrRoutingConfig('single');
    const port = parameters.port || trRoutingSingleConfig.port;
    const serviceName = getServiceName(port);
    const tagName = 'trRouting';

    return await ProcessManager.stopProcess(serviceName, tagName);
};

const restart = async (
    parameters: TrRoutingStartParameters & {
        doNotStartIfStopped?: boolean;
    }
) => {
    const trRoutingSingleConfig = serverConfig.getTrRoutingConfig('single');
    const port = parameters.port || trRoutingSingleConfig.port;
    const serviceName = getServiceName(port);
    const cacheAllScenarios = trRoutingSingleConfig.cacheAllScenarios;

    const params: Parameters<typeof startTrRoutingProcess>[3] = {
        debug: parameters.debug,
        cacheDirectoryPath: parameters.cacheDirectoryPath,
        cacheAllScenarios: cacheAllScenarios
    };

    if (parameters.doNotStartIfStopped && !(await ProcessManager.isServiceRunning(serviceName))) {
        console.log('trRouting was not running and does not need to be started');

        return {
            status: 'no_restart_required',
            service: 'trRouting',
            name: serviceName
        };
    } else {
        // TODO Check why we need this await, should be be useful before returning
        return await startTrRoutingProcess(port, true, DEFAULT_THREAD_COUNT, params);
    }
};

const status = async (parameters: { port?: number }) => {
    const port = parameters.port || serverConfig.getTrRoutingConfig('single').port;
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
    numberOfCpus?: number,
    {
        port = serverConfig.getTrRoutingConfig('batch').port,
        cacheDirectoryPath = undefined,
        debug = false
    }: TrRoutingStartParameters = {}
) {
    // Ensure we don't use more CPU than configured
    // TODO The os.cpus().length should move to a "default config management class"
    const maxThreadCount = config.maxParallelCalculators || os.cpus().length;
    if (numberOfCpus === undefined) {
        numberOfCpus = maxThreadCount;
    } else if (numberOfCpus > maxThreadCount) {
        console.warn('Asking for too many trRouting threads (%d), reducing to %d', numberOfCpus, maxThreadCount);
        numberOfCpus = maxThreadCount;
    }
    const cacheAllScenarios = serverConfig.getTrRoutingConfig('batch').cacheAllScenarios;

    const params = { cacheDirectoryPath: cacheDirectoryPath, cacheAllScenarios, debug };

    await startTrRoutingProcess(port, false, numberOfCpus, params);

    return {
        status: 'started',
        service: 'trRoutingBatch',
        port: port
    };
};

const stopBatch = async function (port: number = serverConfig.getTrRoutingConfig('batch').port) {
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
