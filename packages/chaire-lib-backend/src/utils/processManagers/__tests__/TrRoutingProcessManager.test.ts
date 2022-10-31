import { directoryManager } from '../../filesystem/directoryManager';
import TrRoutingProcessManager from '../TrRoutingProcessManager';
import ProcessManager from '../ProcessManager';
import osrmService from '../../osrm/OSRMService';
import OSRMMode from '../../osrm/OSRMMode';

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
            ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`],
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
            ['--port=4000', `--osrmPort=${walkingOsrmMode.getHostPort().port}`, `--osrmHost=${walkingOsrmMode.getHostPort().host}`, '--debug=0', `--cachePath=${directoryManager.projectDirectory}/cache/test`],
            'ready.',
            false,
            __dirname,
            false
        );
    });
});