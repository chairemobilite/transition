/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import MemcachedProcessManager, { MemcachedInstance } from '../MemcachedProcessManager';
import ProcessManager from '../ProcessManager';

jest.mock('../ProcessManager', () => ({
    startProcess: jest.fn(),
    stopProcess: jest.fn(),
    isServiceRunning: jest.fn()
}));

const startProcessMock = ProcessManager.startProcess as jest.MockedFunction<typeof ProcessManager.startProcess>;
const stopProcessMock = ProcessManager.stopProcess as jest.MockedFunction<typeof ProcessManager.stopProcess>;
const isServiceRunningMock = ProcessManager.isServiceRunning as jest.MockedFunction<typeof ProcessManager.isServiceRunning>;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('MemcachedProcessManager.start', () => {
    test.each([
        {
            name: 'default port',
            options: undefined,
            mockReturn: { status: 'started', service: 'memcached', name: 'memcached' },
            expectedServer: 'localhost:11212',
            expectedServiceName: 'memcached11212',
            expectedCommandArgs: ['--port=11212', '--user=nobody', '-vv']
        },
        {
            name: 'custom port',
            options: { port: 11300 },
            mockReturn: { status: 'started', service: 'memcached', name: 'memcached' },
            expectedServer: 'localhost:11300',
            expectedServiceName: 'memcached11300',
            expectedCommandArgs: ['--port=11300', '--user=nobody', '-vv']
        }
    ])('should start memcached with $name', async ({ options, mockReturn, expectedServer, expectedServiceName, expectedCommandArgs }) => {
        startProcessMock.mockResolvedValue(mockReturn);

        const instance = await MemcachedProcessManager.start(options);

        expect(instance).not.toBeNull();
        expect(instance?.getServer()).toBe(expectedServer);
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith(
            expect.objectContaining({
                serviceName: expectedServiceName,
                tagName: 'memcached',
                command: 'memcached',
                commandArgs: expectedCommandArgs,
                waitString: '',
                useShell: false,
                attemptRestart: false
            })
        );
    });

    test.each([
        {
            name: 'memcached executable not found',
            mockReturn: { status: 'error', service: 'memcached', name: 'memcached', error: { code: 'ENOENT' } },
            expectedErrorMessage: 'memcached executable does not exist in path'
        },
        {
            name: 'other error',
            mockReturn: { status: 'error', service: 'memcached', name: 'memcached', error: { message: 'Some error' } },
            expectedErrorMessage: 'cannot start memcached:'
        },
        {
            name: 'memcached is already running',
            mockReturn: { status: 'already_running', service: 'memcached', name: 'memcached', error: { message: 'already running' } },
            expectedErrorMessage: 'a memcached process already exist for port:'
        }
    ])('should return null when $name', async ({ mockReturn, expectedErrorMessage }) => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        startProcessMock.mockResolvedValue(mockReturn);

        const instance = await MemcachedProcessManager.start();

        expect(instance).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            expect.stringContaining(expectedErrorMessage),
            ...(expectedErrorMessage.includes(':') ? [expect.anything()] : [])
        );
        consoleErrorSpy.mockRestore();
    });
});

describe('MemcachedInstance', () => {
    let instance: MemcachedInstance;

    beforeEach(async () => {
        startProcessMock.mockResolvedValue({
            status: 'started',
            service: 'memcached',
            name: 'memcached'
        });
        instance = (await MemcachedProcessManager.start())!;
    });

    test('getServer should return correct server string', () => {
        expect(instance.getServer()).toBe('localhost:11212');
    });

    test.each([
        { isRunning: true, expectedStatus: 'running' },
        { isRunning: false, expectedStatus: 'not_running' }
    ])('status should return $expectedStatus when process is $expectedStatus', async ({ isRunning, expectedStatus }) => {
        isServiceRunningMock.mockResolvedValue(isRunning);

        const status = await instance.status();

        expect(status).toBe(expectedStatus);
        expect(isServiceRunningMock).toHaveBeenCalledWith('memcached11212');
    });

    test.each([
        { mockStatus: 'stopped', expectedStatus: 'stopped' },
        { mockStatus: 'not_running', expectedStatus: 'not_running' },
        { mockStatus: 'error', expectedStatus: 'error' }
    ])('stop should handle $mockStatus status', async ({ mockStatus, expectedStatus }) => {
        stopProcessMock.mockResolvedValue({
            status: mockStatus,
            service: 'memcached',
            name: 'memcached'
        });

        const result = await instance.stop();

        expect(result.status).toBe(expectedStatus);
        expect(stopProcessMock).toHaveBeenCalledWith('memcached11212', 'memcached');
    });
});
