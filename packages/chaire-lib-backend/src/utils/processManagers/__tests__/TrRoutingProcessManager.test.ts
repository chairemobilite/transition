/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { directoryManager } from '../../filesystem/directoryManager';
import TrRoutingProcessManager from '../TrRoutingProcessManager';
import ProcessManager from '../ProcessManager';
import osrmService from '../../osrm/OSRMService';
import OSRMMode from '../../osrm/OSRMMode';
import config , { setProjectConfiguration }from '../../../config/server.config';

jest.mock('../ProcessManager', () => ({
    startProcess: jest.fn(),
    stopProcess: jest.fn(),
    isServiceRunning: jest.fn().mockResolvedValue(false)
}));
jest.mock('../../osrm/OSRMService', () => ({
    getMode: jest.fn()
}));
const startProcessMock = ProcessManager.startProcess as jest.MockedFunction<typeof ProcessManager.startProcess>;
const stopProcessMock = ProcessManager.stopProcess as jest.MockedFunction<typeof ProcessManager.stopProcess>;
const isServiceRunningMock = ProcessManager.isServiceRunning as jest.MockedFunction<typeof ProcessManager.isServiceRunning>;
const getModeMock = osrmService.getMode as jest.MockedFunction<typeof osrmService.getMode>;
const walkingOsrmMode = new OSRMMode('walking', 'localhost', 1234, true);
getModeMock.mockImplementation((mode) => walkingOsrmMode);

startProcessMock.mockImplementation(async ({ tagName, serviceName }) => ({
    status: 'started',
    action: 'start',
    service: tagName,
    name: serviceName
}));
// Clone the original config to reset it after each test
let originalTestConfig = _cloneDeep(config);
beforeEach(function () {
    jest.clearAllMocks();
    // Reset the config to default
    setProjectConfiguration(originalTestConfig);
    // Override max parallel setting
    // TODO might be a better way to do this
    config.maxParallelCalculators = 8;
    // Need to delete this option as the setProjectConfiguration does not overwrite but adds to the config, so if set in a test, it won't be removed
    delete config.trRoutingCacheAllScenarios;
});

describe('TrRouting Process Manager: start', () => {

    beforeEach(function () {
        // Reset TR_ROUTING_PATH environment variable
        delete process.env.TR_ROUTING_PATH;
    });

    test('start process from default path', async () => {
        const status = await TrRoutingProcessManager.start({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });

    test('start process from TR_ROUTING_PATH environment variable', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.start({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start process with a specific port number', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.start({port: 1234});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting1234'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting1234',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=1234', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start process with a custom cache directory', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.start({cacheDirectoryPath:"/tmp/cache"});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=/tmp/cache`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start process with configured port and cacheAllScenarios for single trRouting', async () => {
        // Add a port and cacheAllScenarios to the trRouting single config
        const port = 4002;
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { single: { port, cacheAllScenarios: true } } as any } } as any } });
        const status = await TrRoutingProcessManager.start({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: `trRouting${port}`
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: `trRouting${port}`,
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2', '--cacheAllConnectionSets=true'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
        
    });
    test('start process with all parameters set', async () => {
        const port = 1234;
        const debug = true;
        const cacheDirectoryPath = "/tmp/cache";
        const status = await TrRoutingProcessManager.start({ port, debug, cacheDirectoryPath });
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: `trRouting${port}`
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: `trRouting${port}`,
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${cacheDirectoryPath}`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start process with deprecated trRoutingCacheAllScenarios configuration option', async () => {
        // Add a port and cacheAllScenarios to the trRouting single config
        setProjectConfiguration({ trRoutingCacheAllScenarios: true });
        const status = await TrRoutingProcessManager.start({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2', '--cacheAllConnectionSets=true'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('With debug and logFiles in the config', async () => {
        const logFiles = { maxFileSizeKB: 1500, nbFiles: 5 };
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { single: { debug: true, logs: logFiles } } as any } } as any } });
        const status = await TrRoutingProcessManager.start({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: logFiles.nbFiles,
                maxFileSizeKB: logFiles.maxFileSizeKB
            }
        });
    });
});

describe('TrRouting Process Manager: restart', () => {

    beforeEach(function () {
        // Reset TR_ROUTING_PATH environment variable
        delete process.env.TR_ROUTING_PATH;
    });

    test('from default path', async () => {
        const status = await TrRoutingProcessManager.restart({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });

    test('from TR_ROUTING_PATH environment variable', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.restart({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('with a specific port number', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.restart({port: 1234});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting1234'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting1234',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=1234', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('with a custom cache directory', async () => {
        process.env.TR_ROUTING_PATH = __dirname;
        const status = await TrRoutingProcessManager.restart({cacheDirectoryPath:"/tmp/cache"});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: './trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=/tmp/cache`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: __dirname,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start process with configured port and cacheAllScenarios for single trRouting', async () => {
        // Add a port and cacheAllScenarios to the trRouting single config
        const port = 4002;
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { single: { port, cacheAllScenarios: true } } as any } } as any } });
        const status = await TrRoutingProcessManager.restart({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: `trRouting${port}`
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: `trRouting${port}`,
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2', '--cacheAllConnectionSets=true'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
        
    });
    test('with all parameters set', async () => {
        // Return service is running, it should not affect the outcome in this case
        isServiceRunningMock.mockResolvedValue(true);
        const port = 1234;
        const debug = true;
        const cacheDirectoryPath = "/tmp/cache";
        const status = await TrRoutingProcessManager.restart({ port, debug, cacheDirectoryPath });
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: `trRouting${port}`
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: `trRouting${port}`,
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${cacheDirectoryPath}`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('doNotStartIfStopped true, process not running', async () => {
        // Return that the process is not running, ti should not be started
        isServiceRunningMock.mockResolvedValue(false);
        const status = await TrRoutingProcessManager.restart({ doNotStartIfStopped: true});
        expect(status).toEqual({
            status: 'no_restart_required',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).not.toHaveBeenCalled();
    });
    test('doNotStartIfStopped true, process running', async () => {
        // Return that the process is running, should attempt restart
        isServiceRunningMock.mockResolvedValueOnce(true);
        const status = await TrRoutingProcessManager.restart({ doNotStartIfStopped: true});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('With debug and logFiles in the config', async () => {
        const logFiles = { maxFileSizeKB: 1500, nbFiles: 5 };
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { single: { debug: true, logs: logFiles } } as any } } as any } });
        const status = await TrRoutingProcessManager.restart({});
        expect(status).toEqual({
            status: 'started',
            action: 'start',
            service: 'trRouting',
            name: 'trRouting4000'
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting4000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: true,
            logFiles: {
                nbLogFiles: logFiles.nbFiles,
                maxFileSizeKB: logFiles.maxFileSizeKB
            }
        });
    });
});

describe('TrRouting Process Manager: startBatch', () => {

    beforeEach(function () {
        // Reset TR_ROUTING_PATH environment variable
        delete process.env.TR_ROUTING_PATH;
    });

    test('start batch process with 1 cpu', async () => {
        const status = await TrRoutingProcessManager.startBatch(1);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting14000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start batch process with 4 cpus', async () => {
        const status = await TrRoutingProcessManager.startBatch(4);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting14000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start batch process with 4 cpus with 2 limit', async () => {
        // Override the configuration
        // TODO might have a better way to do this
        config.maxParallelCalculators = 2;

        const status = await TrRoutingProcessManager.startBatch(4);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting14000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start batch process with 4 cpus on a custom port', async () => {
        const status = await TrRoutingProcessManager.startBatch(4, { port: 12345 });
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 12345
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting12345',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=12345', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('start batch process with 4 cpus with port and cacheAll configuration', async () => {
        // Add a port and cacheAllScenarios to the trRouting batch config
        const port = 14002;
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { batch: { port, cacheAllScenarios: true } } as any } } as any } });
        const status = await TrRoutingProcessManager.startBatch(4);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: `trRouting${port}`,
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4', '--cacheAllConnectionSets=true'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });

    test('start batch process with all parameters set', async () => {
        const port = 12345;
        const debug = true;
        const cacheDirectoryPath = "/tmp/cache";
        const status = await TrRoutingProcessManager.startBatch(4, { port, debug, cacheDirectoryPath });
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 12345
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting12345',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: [`--port=${port}`, `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${cacheDirectoryPath}`, '--threads=4'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: 3,
                maxFileSizeKB: 5120
            }
        });
    });
    test('With debug and logFiles in the config', async () => {
        const logFiles = { maxFileSizeKB: 1500, nbFiles: 5 };
        setProjectConfiguration({ routing: { transit: { engines: { trRouting: { batch: { debug: true, logs: logFiles } } as any } } as any } });
        const status = await TrRoutingProcessManager.startBatch(4);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'trRouting14000',
            tagName: 'trRouting',
            command: 'trRouting',
            commandArgs: ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=1', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4'],
            waitString: 'ready.',
            useShell: false,
            cwd: undefined,
            attemptRestart: false,
            logFiles: {
                nbLogFiles: logFiles.nbFiles,
                maxFileSizeKB: logFiles.maxFileSizeKB
            }
        });
    });
});
