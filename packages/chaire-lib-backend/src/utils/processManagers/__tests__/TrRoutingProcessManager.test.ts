import { directoryManager } from '../../filesystem/directoryManager';
import TrRoutingProcessManager from '../TrRoutingProcessManager';
import ProcessManager from '../ProcessManager';
import osrmService from '../../osrm/OSRMService';
import OSRMMode from '../../osrm/OSRMMode';
import config from '../../../config/server.config';

jest.mock('../ProcessManager', () => ({
    startProcess: jest.fn(),
    stopProcess: jest.fn()
}));
jest.mock('../../osrm/OSRMService', () => ({
    getMode: jest.fn()
}));
const startProcessMock = ProcessManager.startProcess as jest.MockedFunction<typeof ProcessManager.startProcess>;
const stopProcessMock = ProcessManager.stopProcess as jest.MockedFunction<typeof ProcessManager.stopProcess>;
const getModeMock = osrmService.getMode as jest.MockedFunction<typeof osrmService.getMode>;
const walkingOsrmMode = new OSRMMode('walking', 'localhost', 1234, true);
getModeMock.mockImplementation((mode) => walkingOsrmMode);

startProcessMock.mockImplementation(async (serviceName: string,
    tagName: string,
    command: string,
    commandArgs: any,
    waitString: string,
    useShell: boolean,
    cwd?: string,
    attemptRestart = false) => ({
    status: 'started',
    action: 'start',
    service: tagName,
    name: serviceName
}));
beforeEach(function () {
    startProcessMock.mockClear();
    stopProcessMock.mockClear();
    // Override max parallel setting
    // TODO might be a better way to do this
    config.maxParallelCalculators = 8;
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
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting4000',
            'trRouting',
            'trRouting',
            ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            'ready.',
            false,
            undefined,
            false
        );
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
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting4000',
            'trRouting',
            './trRouting',
            ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            'ready.',
            false,
            __dirname,
            false
        );
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
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting1234',
            'trRouting',
            './trRouting',
            ['--port=1234', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            'ready.',
            false,
            __dirname,
            false
        );
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
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting4000',
            'trRouting',
            './trRouting',
            ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=/tmp/cache`, '--threads=2'],
            'ready.',
            false,
            __dirname,
            false
        );
    });
    test('start batch process with 1 cpu', async () => {
        const status = await TrRoutingProcessManager.startBatch(1);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting14000',
            'trRouting',
            'trRouting',
            ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`],
            'ready.',
            false,
            undefined,
            false
        );
    });
    test('start batch process with 4 cpus', async () => {
        const status = await TrRoutingProcessManager.startBatch(4);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting14000',
            'trRouting',
            'trRouting',
            ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4'],
            'ready.',
            false,
            undefined,
            false
        );
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
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting14000',
            'trRouting',
            'trRouting',
            ['--port=14000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=2'],
            'ready.',
            false,
            undefined,
            false
        );
    });
    test('start batch process with 4 cpus on a custom port', async () => {
        const status = await TrRoutingProcessManager.startBatch(4, 12345);
        expect(status).toEqual({
            status: 'started',
            service: 'trRoutingBatch',
            port: 12345
        });
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith(
            'trRouting12345',
            'trRouting',
            'trRouting',
            ['--port=12345', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`, '--threads=4'],
            'ready.',
            false,
            undefined,
            false
        );
    });
});
