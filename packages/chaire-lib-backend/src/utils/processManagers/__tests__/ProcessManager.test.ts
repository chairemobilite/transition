/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const mockSpawn = require('mock-spawn');

let testSpawn = mockSpawn();

import { DEFAULT_LOG_FILE_SIZE_KB } from '../../../config/server.config';
//TODO maybe use just fs object calls
import { fileManager } from '../../filesystem/fileManager';
import ProcessManager from '../ProcessManager';
import ProcessUtils from '../ProcessUtils';
import winston from 'winston';

// Mock ProcessUtils
jest.mock('../ProcessUtils');
const mockPidRunning = jest.fn();

mockPidRunning.mockReturnValue(true);
mockPidRunning.mockName('Mock_IsPidRunning');
ProcessUtils.isPidRunning = mockPidRunning;

// Mock winston logger to create a mock logger
jest.mock('winston', () => {
    // Require the original module to not be mocked...
    const originalModule = jest.requireActual('winston');
    const originalCreateLogger = originalModule.createLogger;

    return {
        ...originalModule,
        createLogger: jest.fn().mockImplementation((args) => originalCreateLogger(args))
    };
});
const createLoggerMock = winston.createLogger as jest.MockedFunction<typeof winston.createLogger>;

// Mock process.kill to make sure we don't kill random processes
// TODO, Maybe use jest.spyon() to restore it after each test
const mockKill = jest.fn();
mockKill.mockName('Mock Process.Kill()');
mockKill.mockImplementation((pid, signal?) => {console.log(`Fake killing process ${pid}`); return true;});
global.process.kill = mockKill;

const testServiceName = 'TestService1';
jest.setTimeout(30000);

describe('Process Manager testing', () => {
    beforeEach(() => {
        const verbose = true; // make it true to see additional verbose output
        testSpawn = mockSpawn(verbose);
        testSpawn.setStrategy(null);
        require('child_process').spawn = testSpawn;

        //TODO Mock the logger in ProcessManager

        fileManager.deleteFile('pids/TestService1.pid');

    });
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('Simple Start/Stop', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));


        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('1');

        // Test the logger creation
        expect(createLoggerMock).toHaveBeenCalled();
        expect(createLoggerMock).toHaveBeenCalledWith(expect.objectContaining({
            level: 'info',
            transports: [
                expect.anything()
            ]
        }));
        const logger = createLoggerMock.mock.calls[0][0];
        const fileTransport = (logger as any).transports[0] as winston.transports.FileTransportInstance;
        expect(fileTransport.maxsize).toEqual(DEFAULT_LOG_FILE_SIZE_KB * 1024);
        expect(fileTransport.maxFiles).toEqual(3);

        // CHeck isServiceRunning
        mockPidRunning.mockReturnValue(true);
        const resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(true);
        expect(mockPidRunning).toHaveBeenCalled();

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        const resultStop = await ProcessManager.stopProcess(testServiceName, 'TEST');
        expect(resultStop.status).toBe('stopped');
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(1);
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

    });

    test('Simple Start/Restart/Stop', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('2');

        // Restart serivce
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
        const resultRestart = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false,
            attemptRestart: true
        });
        expect(resultRestart.status).toBe('started');
        expect(mockPidRunning).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(2);

        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('3');

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        const resultStop = await ProcessManager.stopProcess(testServiceName, 'TEST');
        expect(resultStop.status).toBe('stopped');
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(2);
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

    });

    test('Bad Start', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Not Good!'));

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        // TODO, the spawn mock simulate a process that exit immediatly, so this is not fully
        // representative of a process that would still run, but don't have the right output. Still
        // covering some of the code path
        expect(result.status).toBe('not_running');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

    });

    test('Bad ReStart (no stop)', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Restart service
        mockPidRunning.mockReturnValue(true);
        const resultRestart = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false,
            attemptRestart: true
        });
        expect(resultRestart.status).toBe('could_not_restart');
        expect(mockPidRunning).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalled();
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
    });

    test('Clean up of stale PID file', async () => {
        fileManager.writeFile('pids/TestService1.pid', '1234');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // CHeck isServiceRunning
        mockPidRunning.mockReturnValue(false);
        const resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

    });

    test('stale PID file, no clean up', async () => {
        fileManager.writeFile('pids/TestService1.pid', '1234');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false);
        const resultIsRunning = await ProcessManager.isServiceRunning(testServiceName, false);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

    });

    test('corrupted PID file', async () => {
        fileManager.writeFile('pids/TestService1.pid', 'abcdef');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false);
        const resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(false);
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        fileManager.writeFile('pids/TestService1.pid', '');
        fileManager.truncateFile('pids/TestService1.pid');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false);
        const resultIsRunning2 = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning2).toBe(false);
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);
    });

    test('Start already running service', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        mockPidRunning.mockReturnValue(true);

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('6');

        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        // Start same service
        const result2 = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result2.status).toBe('already_running');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('6');




    });

    test('Start multiple services', async () => {
        // Make sure we are in a clean state
        fileManager.deleteFile('pids/OtherService.pid');


        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        testSpawn.sequence.add(testSpawn.simple(0, 'Other Good'));
        mockPidRunning.mockReturnValue(true);

        // Start first service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('7');
        // Start other service

        const resultOther = await ProcessManager.startProcess({
            serviceName: 'OtherService',
            tagName: 'TEST',
            command: 'cat',
            commandArgs: ['-l'],
            waitString: 'Other Good',
            useShell: false
        });
        expect(resultOther.status).toBe('started');
        expect(fileManager.fileExists('pids/OtherService.pid')).toBe(true);
        expect(fileManager.readFile('pids/OtherService.pid')).toBe('8');

        // Clean up
        fileManager.deleteFile('pids/OtherService.pid');

    });

    test('Start-[service is killed]-Stop', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));


        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('9');

        // Simulate dead process
        mockPidRunning.mockReturnValue(false);

        // CHeck isServiceRunning
        const resultIsRunning = await ProcessManager.isServiceRunning(testServiceName, false);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();

        // Stop service
        const resultStop = await ProcessManager.stopProcess(testServiceName, 'TEST');
        expect(resultStop.status).toBe('not_running');
        expect(mockKill).toHaveBeenCalledTimes(0);
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

    });

    test('Exception in process.kill', async () => {
        const mockKillThrow = jest.fn();
        mockKillThrow.mockImplementation((pid, signal?) => {
            console.log(`Fake killing process ${pid} with exception`);
            throw Error('Invalid  process');
        });
        global.process.kill = mockKillThrow;
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));


        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        const resultStop = await ProcessManager.stopProcess(testServiceName, 'TEST');
        expect(resultStop.status).toBe('not_running');
        expect(mockKillThrow).toHaveBeenCalled();
        // TODO Should we clean up the file if we get the exception. (It might also be a permission issue)
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        global.process.kill = mockKill;
    });

    test('Start/Stop with log file configuration', async () => {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        // Start service, with 3 logs files of 2 MB each
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: 'All Good',
            logFiles: {
                maxFileSizeKB: 2048,
                nbLogFiles: 5
            }
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);

        // Test the logger creation
        expect(createLoggerMock).toHaveBeenCalled();
        expect(createLoggerMock).toHaveBeenCalledWith(expect.objectContaining({
            level: 'info',
            transports: [
                expect.anything()
            ]
        }));
        const logger = createLoggerMock.mock.calls[0][0];
        const fileTransport = (logger as any).transports[0] as winston.transports.FileTransportInstance;
        expect(fileTransport.maxsize).toEqual(2048 * 1024);
        expect(fileTransport.maxFiles).toEqual(5);
    });

    test('Start no wait string', async () => {
        testSpawn.sequence.add(function (this: any, cb) {
            // Create a mock process object
            const mockProcess = {
                stdout: { on: jest.fn() },
                stderr: { on: jest.fn() },
                on: jest.fn()
            };

            // Emit the spawn event immediately
            this.emit('spawn', mockProcess);

            // Then small delay to leave time for the event emit and then exit
            setTimeout(() => {
                return cb(0);
            }, 100);

            // Return the mock process
            return mockProcess;
        });

        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(false);

        // Start service
        const result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: 'TEST',
            command: 'ls',
            commandArgs: ['-l'],
            waitString: '',
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists('pids/TestService1.pid')).toBe(true);
        expect(fileManager.readFile('pids/TestService1.pid')).toBe('12');
    });
});

