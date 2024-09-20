/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
var mockSpawn = require('mock-spawn');

var testSpawn = mockSpawn();

//TODO maybe use just fs object calls
import { fileManager } from '../../filesystem/fileManager';
import ProcessManager from '../ProcessManager';
import ProcessUtils from '../ProcessUtils';

// Mock ProcessUtils
jest.mock('../ProcessUtils');
const mockPidRunning = jest.fn();

mockPidRunning.mockReturnValue(true);
mockPidRunning.mockName("Mock_IsPidRunning");
ProcessUtils.isPidRunning = mockPidRunning;


// Mock process.kill to make sure we don't kill random processes
// TODO, Maybe use jest.spyon() to restore it after each test
const mockKill = jest.fn();
mockKill.mockName("Mock Process.Kill()");
mockKill.mockImplementation((pid, signal?) => {console.log(`Fake killing process ${pid}`); return true;});
global.process.kill = mockKill;

const testServiceName = "TestService1";
jest.setTimeout(30000);

describe('Process Manager testing', function() {
    beforeEach(function () {
        var verbose = true; // make it true to see additional verbose output
        testSpawn = mockSpawn(verbose);
        testSpawn.setStrategy(null);
        require('child_process').spawn = testSpawn;
        
        //TODO Mock the logger in ProcessManager

        fileManager.deleteFile("pids/TestService1.pid");

    });
    afterEach(function () {
        jest.resetAllMocks();
    });
    
    test('Simple Start/Stop', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));


        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);

        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });      
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("1");

        // CHeck isServiceRunning
        mockPidRunning.mockReturnValue(true)
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(true);
        expect(mockPidRunning).toHaveBeenCalled();

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        var resultStop = await ProcessManager.stopProcess(testServiceName, "TEST");
        expect(resultStop.status).toBe("stopped");
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(1);
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);
        
    });
    
    test('Simple Start/Restart/Stop', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);
        
        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });      
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("2");


        // Restart serivce
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValueOnce(false);
        var resultRestart = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false,
            attemptRestart: true
        });
        expect(resultRestart.status).toBe('started');
        expect(mockPidRunning).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(2);

        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("3");

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        var resultStop = await ProcessManager.stopProcess(testServiceName, "TEST");
        expect(resultStop.status).toBe("stopped");
        expect(mockKill).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalledWith(2);
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);
        
    });
    
    test('Bad Start', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Not Good!'));

        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        // TODO, the spawn mock simulate a process that exit immediatly, so this is not fully
        // representative of a process that would still run, but don't have the right output. Still
        // covering some of the code path
        expect(result.status).toBe('not_running');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);

    });
    
    test('Bad ReStart (no stop)', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        
        // Restart service
        mockPidRunning.mockReturnValue(true);
        var resultRestart = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false,
            attemptRestart: true
        });
        expect(resultRestart.status).toBe('could_not_restart');
        expect(mockPidRunning).toHaveBeenCalled();
        expect(mockKill).toHaveBeenCalled();
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
    });
    
    test('Clean up of stale PID file', async function() {
        fileManager.writeFile("pids/TestService1.pid", "1234")
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        
        // CHeck isServiceRunning
        mockPidRunning.mockReturnValue(false)
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);    
        
    });
    
    test('stale PID file, no clean up', async function() {
        fileManager.writeFile("pids/TestService1.pid", "1234");
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        
        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false)
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName, false);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);     
        
    });
    
    test('corrupted PID file', async function() {
        fileManager.writeFile("pids/TestService1.pid", "abcdef");
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        
        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false)
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(false);    
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);    

        fileManager.writeFile("pids/TestService1.pid", "");
        fileManager.truncateFile("pids/TestService1.pid");
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        
        // Check isServiceRunning
        mockPidRunning.mockReturnValue(false);
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName);
        expect(resultIsRunning).toBe(false);    
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);    
    });
    
    test('Start already running service', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));        
        mockPidRunning.mockReturnValue(true);
        
        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("6");

        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        // Start same service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        expect(result.status).toBe('already_running');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("6");

        
        
        
    });
    
    test('Start multiple services', async function() {
        // Make sure we are in a clean state
        fileManager.deleteFile("pids/OtherService.pid");

        
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));
        testSpawn.sequence.add(testSpawn.simple(0, 'Other Good'));      
        mockPidRunning.mockReturnValue(true);
        
        // Start first service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("7");
        // Start other service
        
        var resultOther = await ProcessManager.startProcess({
            serviceName: "OtherService",
            tagName: "TEST",
            command: "cat",
            commandArgs: ["-l"],
            waitString: "Other Good",
            useShell: false
        });
        expect(resultOther.status).toBe('started');
        expect(fileManager.fileExists("pids/OtherService.pid")).toBe(true);
        expect(fileManager.readFile("pids/OtherService.pid")).toBe("8");

        // Clean up
        fileManager.deleteFile("pids/OtherService.pid");
        
    });
    
    test('Start-[service is killed]-Stop', async function() {
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));


        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);

        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        });
        expect(result.status).toBe('started');
        expect(testSpawn.calls[0].command).toBe('ls');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);
        expect(fileManager.readFile("pids/TestService1.pid")).toBe("9");

        // Simulate dead process
        mockPidRunning.mockReturnValue(false);
        
        // CHeck isServiceRunning
        var resultIsRunning = await ProcessManager.isServiceRunning(testServiceName, false);
        expect(resultIsRunning).toBe(false);
        expect(mockPidRunning).toHaveBeenCalled();

        // Stop service
        var resultStop = await ProcessManager.stopProcess(testServiceName, "TEST");
        expect(resultStop.status).toBe("not_running");
        expect(mockKill).toHaveBeenCalledTimes(0);
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(false);
        
    });
    
    test('Exception in process.kill', async function() {
        const mockKillThrow = jest.fn();
        mockKillThrow.mockImplementation((pid, signal?) => {console.log(`Fake killing process ${pid} with exception`);
                                                            throw Error("Invalid  process");
                                                            return true;});
        global.process.kill = mockKillThrow;
        testSpawn.sequence.add(testSpawn.simple(0, 'All Good'));

        
        // Start service
        var result = await ProcessManager.startProcess({
            serviceName: testServiceName,
            tagName: "TEST",
            command: "ls",
            commandArgs: ["-l"],
            waitString: "All Good",
            useShell: false
        }); 
        expect(result.status).toBe('started');
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);

        // Stop service
        mockPidRunning.mockReturnValueOnce(true).mockReturnValueOnce(false);
        var resultStop = await ProcessManager.stopProcess(testServiceName, "TEST");
        expect(resultStop.status).toBe("not_running");
        expect(mockKillThrow).toHaveBeenCalled();
        // TODO Should we clean up the file if we get the exception. (It might also be a permission issue)
        expect(fileManager.fileExists("pids/TestService1.pid")).toBe(true);     

        global.process.kill = mockKill;
    });
    
});

