/*
 * Copyright 2025, Polytechnique Montreal and contributors
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
    test('should start memcached with default port', async () => {
        startProcessMock.mockResolvedValue({
            status: 'started',
            service: 'memcached',
            name: 'memcached'
        });

        const instance = await MemcachedProcessManager.start();

        expect(instance).not.toBeNull();
        expect(instance?.getServer()).toBe('localhost:11212');
        expect(startProcessMock).toHaveBeenCalledTimes(1);
        expect(startProcessMock).toHaveBeenCalledWith({
            serviceName: 'memcached',
            tagName: 'memcached',
            command: 'memcached',
            commandArgs: ['--port=11212', '--user=nobody', '-vv'],
            waitString: '',
            useShell: false,
            attemptRestart: false
        });
    });

    test('should start memcached with custom port', async () => {
        startProcessMock.mockResolvedValue({
            status: 'started',
            service: 'memcached',
            name: 'memcached'
        });

        const instance = await MemcachedProcessManager.start({ port: 11300 });

        expect(instance).not.toBeNull();
        expect(instance?.getServer()).toBe('localhost:11300');
        expect(startProcessMock).toHaveBeenCalledWith(
            expect.objectContaining({
                commandArgs: ['--port=11300', '--user=nobody', '-vv']
            })
        );
    });

    test('should return instance when already running', async () => {
        startProcessMock.mockResolvedValue({
            status: 'already_running',
            service: 'memcached',
            name: 'memcached'
        });

        const instance = await MemcachedProcessManager.start();

        expect(instance).not.toBeNull();
        expect(instance?.getServer()).toBe('localhost:11212');
    });

    test('should return null when memcached executable not found', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        startProcessMock.mockResolvedValue({
            status: 'error',
            service: 'memcached',
            name: 'memcached',
            error: { code: 'ENOENT' }
        });

        const instance = await MemcachedProcessManager.start();

        expect(instance).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('memcached executable does not exist in path');
        consoleErrorSpy.mockRestore();
    });

    test('should return null on other errors', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        startProcessMock.mockResolvedValue({
            status: 'error',
            service: 'memcached',
            name: 'memcached',
            error: { message: 'Some error' }
        });

        const instance = await MemcachedProcessManager.start();

        expect(instance).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith('cannot start memcached:', expect.anything());
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

    test('status should return running when process is running', async () => {
        isServiceRunningMock.mockResolvedValue(true);

        const status = await instance.status();

        expect(status).toBe('running');
        expect(isServiceRunningMock).toHaveBeenCalledWith('memcached');
    });

    test('status should return not_running when process is not running', async () => {
        isServiceRunningMock.mockResolvedValue(false);

        const status = await instance.status();

        expect(status).toBe('not_running');
    });

    test('stop should call ProcessManager.stopProcess', async () => {
        stopProcessMock.mockResolvedValue({
            status: 'stopped',
            service: 'memcached',
            name: 'memcached'
        });

        const result = await instance.stop();

        expect(result.status).toBe('stopped');
        expect(stopProcessMock).toHaveBeenCalledWith('memcached', 'memcached');
    });

    test('stop should handle not_running status', async () => {
        stopProcessMock.mockResolvedValue({
            status: 'not_running',
            service: 'memcached',
            name: 'memcached'
        });

        const result = await instance.stop();

        expect(result.status).toBe('not_running');
    });
});
