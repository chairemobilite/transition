/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { directoryManager } from '../filesystem/directoryManager';
import ProcessManager from './ProcessManager';
import osrmService from '../osrm/OSRMService';
import config, { TrRoutingConfig } from '../../config/server.config';
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

type TrRoutingBatchStartParameters = TrRoutingStartParameters & {
    memcachedServer?: string;
};

const getServiceName = function (port: number, processIndex: number = 0) {
    // When spawning multiple instances, the first one will have the classic service name
    // and the other ones (index 1 and above) will have the index added at the end
    if (processIndex <= 0) {
        return `trRouting${port}`;
    } else {
        return `trRouting${port}_${processIndex}`;
    }
};

const startTrRoutingProcess = async (
    port: number,
    attemptRestart = false,
    threadCount = 1,
    {
        debug = undefined,
        cacheDirectoryPath,
        cacheAllScenarios = false,
        logFiles,
        memcachedServer
    }: {
        debug?: boolean;
        cacheDirectoryPath?: string;
        cacheAllScenarios?: boolean; // Flag to enable the trRouting connection cache for all scenario
        logFiles: TrRoutingConfig['logs'];
        memcachedServer?: string; // If defined, enable use of memcached and use the value as the server URL
    },
    processIndex: number = -1
) => {
    const osrmWalkingServerInfo = osrmService.getMode('walking').getHostPort();
    const serviceName = getServiceName(port, processIndex);
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

    // Set the threads argument if we have a threadCount param and it's higher than one
    if (threadCount && threadCount > 1) {
        commandArgs.push(`--threads=${threadCount}`);
    }

    // Enable the caching of all scenario. This consume lot of memory, so it's disabled by default
    if (cacheAllScenarios) {
        commandArgs.push('--cacheAllConnectionSets=true');
    }

    // Enable memcached usage in TrRouting
    if (memcachedServer) {
        commandArgs.push(`--useMemcached=${memcachedServer}`);
    }

    if (processIndex >= 0) {
        commandArgs.push('--enableReusePort=true');
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
        attemptRestart,
        logFiles: {
            nbLogFiles: logFiles.nbFiles,
            maxFileSizeKB: logFiles.maxFileSizeKB
        }
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
    // Get trRouting process configuration
    const trRoutingSingleConfig = serverConfig.getTrRoutingConfig('single');
    const port = parameters.port || trRoutingSingleConfig.port;
    const cacheAllScenarios = trRoutingSingleConfig.cacheAllScenarios;
    const debugFromParamOrConfig = parameters.debug !== undefined ? parameters.debug : trRoutingSingleConfig.debug;

    const params: Parameters<typeof startTrRoutingProcess>[3] = {
        debug: debugFromParamOrConfig,
        cacheDirectoryPath: parameters.cacheDirectoryPath,
        cacheAllScenarios: cacheAllScenarios,
        logFiles: trRoutingSingleConfig.logs
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
    // Get trRouting process configuration
    const trRoutingSingleConfig = serverConfig.getTrRoutingConfig('single');
    const port = parameters.port || trRoutingSingleConfig.port;
    const serviceName = getServiceName(port);
    const cacheAllScenarios = trRoutingSingleConfig.cacheAllScenarios;
    const debugFromParamOrConfig = parameters.debug !== undefined ? parameters.debug : trRoutingSingleConfig.debug;

    const params: Parameters<typeof startTrRoutingProcess>[3] = {
        debug: debugFromParamOrConfig,
        cacheDirectoryPath: parameters.cacheDirectoryPath,
        cacheAllScenarios: cacheAllScenarios,
        logFiles: trRoutingSingleConfig.logs
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

const MAX_THREADS_PER_PROCESS = 16; // TrRouting saturate at 24 threads, so let's not get there

const startBatch = async function (
    numberOfCpus?: number,
    {
        port = serverConfig.getTrRoutingConfig('batch').port,
        cacheDirectoryPath = undefined,
        debug = undefined,
        memcachedServer = undefined
    }: TrRoutingBatchStartParameters = {}
) {
    // Ensure we don't use more CPU than configured
    const maxThreadCount = config.maxParallelCalculators;
    if (numberOfCpus === undefined) {
        numberOfCpus = maxThreadCount;
    } else if (numberOfCpus > maxThreadCount) {
        console.warn('Asking for too many trRouting threads (%d), reducing to %d', numberOfCpus, maxThreadCount);
        numberOfCpus = maxThreadCount;
    }

    // Get trRouting process configuration
    const batchTrRoutingConfig = serverConfig.getTrRoutingConfig('batch');
    const cacheAllScenarios = batchTrRoutingConfig.cacheAllScenarios;
    const debugFromParamOrConfig = debug !== undefined ? debug : batchTrRoutingConfig.debug;

    const params = {
        cacheDirectoryPath: cacheDirectoryPath,
        cacheAllScenarios,
        debug: debugFromParamOrConfig,
        logFiles: batchTrRoutingConfig.logs,
        memcachedServer: memcachedServer
    };

    // Since a single process cannot handle too many threads, we will spawn multiple process
    // TODO This can go away if we change trRouting to handle more threads
    // https://github.com/chairemobilite/trRouting/issues/340
    const processCount = Math.ceil(numberOfCpus / MAX_THREADS_PER_PROCESS);
    const threadsPerProcess = Math.ceil(numberOfCpus / processCount);

    const startPromises: Promise<any>[] = [];
    for (let i = 0; i < processCount; i++) {
        // Last process may get fewer threads if total doesn't divide evenly
        const threads = Math.min(threadsPerProcess, numberOfCpus - i * threadsPerProcess);
        startPromises.push(startTrRoutingProcess(port, false, threads, params, i));
    }
    await Promise.all(startPromises);

    return {
        status: 'started',
        service: 'trRoutingBatch',
        port: port
    };
};

const stopBatch = async function (port: number = serverConfig.getTrRoutingConfig('batch').port) {
    await stop({ port: port }); // Stop the first one the normal way
    // Since we don't have a good way to Iterate through the running extra instances
    // We check for each index and stop if we cannot find one. Only check the first X instances, assuming
    // the absolute max is 256 threads machines.
    for (let i = 1; i <= 256 / MAX_THREADS_PER_PROCESS; i++) {
        const serviceName = getServiceName(port, i);
        if (await ProcessManager.isServiceRunning(serviceName)) {
            await ProcessManager.stopProcess(serviceName, 'trRouting');
        } else {
            break; // No more processes
        }
    }
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
