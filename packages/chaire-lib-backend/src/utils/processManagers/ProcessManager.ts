/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import winston from 'winston';
import { spawn } from 'child_process';
import { fileManager } from '../filesystem/fileManager';
import { directoryManager } from '../filesystem/directoryManager';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import ProcessUtils from './ProcessUtils';

const PID_DIRECTORY = 'pids';

directoryManager.createDirectoryIfNotExists(PID_DIRECTORY);

const getServiceRunningPid = async function (serviceName: string, cleanUpStale = true): Promise<number | null> {
    const pidFilename = `${PID_DIRECTORY}/${serviceName}.pid`;

    if (fileManager.fileExists(pidFilename)) {
        const pidRaw = fileManager.readFile(pidFilename);
        console.debug(`FILE EXIST ${pidFilename}:${pidRaw}`);
        if (pidRaw !== null) {
            //TODO handle invalid parseInt
            const pid = parseInt(pidRaw);
            // File has a PID, lets confirm that it's still running
            const isrunning = ProcessUtils.isPidRunning(pid);

            console.debug(`PID ${pid}, Process IS_RUNNING ${isrunning}`);
            // if we don't have a PID, this means that the data is stale.
            if (!isrunning) {
                if (cleanUpStale) {
                    // Clean up stale entry, if user asked for it
                    fileManager.deleteFile(pidFilename);
                }
                return null;
            }
            return pid;
        } else {
            // File does not contains a valid number, let's delete it if clean up is enabled
            if (cleanUpStale) {
                fileManager.deleteFile(pidFilename);
            }
            return null;
        }
    } else {
        // We don't have a PID file, so we don't have PID number, return null
        return null;
    }
};

const isServiceRunning = async function (serviceName: string, cleanUpStale = true): Promise<boolean> {
    const pid = await getServiceRunningPid(serviceName, cleanUpStale);

    return pid !== null;
};

const getLoggerName = function (tagName: string, serviceName: string) {
    return `${tagName}Logger_${serviceName}_`;
};

const setupLogger = function (tagName: string, serviceName: string) {
    const loggerName = getLoggerName(tagName, serviceName);
    serviceLocator.addService(
        loggerName,
        winston.createLogger({
            level: 'info',
            format: winston.format.simple(),
            transports: [
                new winston.transports.File({
                    filename: fileManager.directoryManager.getAbsolutePath(`logs/${loggerName}.log`),
                    maxsize: 1000000,
                    maxFiles: 1,
                    timestamp: true
                } as any)
            ]
        })
    );
    return loggerName;
};

const startProcess = async function (
    serviceName: string,
    tagName: string,
    command: string,
    commandArgs: any,
    waitString: string,
    useShell: boolean,
    cwd?: string,
    attemptRestart = false
): Promise<any> {
    return new Promise((resolve) => {
        // Check if we already a process running for that serviceName
        // TODO Should be an await instead of then but need to rework the promise to make it work
        getServiceRunningPid(serviceName).then((pid) => {
            console.log(`Starting ${tagName} service ${serviceName} with current pid ${pid}`);

            const doStart = function () {
                // If we reached this point, we don't have a process running or it was stopped

                const loggerName = setupLogger(tagName, serviceName);

                const spawnParams = {
                    shell: useShell,
                    detached: false,
                    cwd: cwd
                };
                const startedProcess = spawn(command, commandArgs, spawnParams);

                startedProcess.stdout.on('data', (data) => {
                    // Validate that process is running with a specific output string
                    if (data.includes(waitString)) {
                        const pidFilename = `${PID_DIRECTORY}/${serviceName}.pid`;
                        console.log(fileManager.writeFile(pidFilename, startedProcess.pid?.toString()));
                        console.log(`${tagName} server (${serviceName}) started pid:${startedProcess.pid}`);
                        // TODO Change status to enum or constant
                        // TODO Type the return
                        resolve({
                            status: 'started',
                            service: tagName,
                            action: 'start',
                            name: serviceName
                        });
                    }

                    // Log all output to file
                    serviceLocator[loggerName].info(data);
                });

                startedProcess.stderr.on('data', (data) => {
                    serviceLocator[loggerName].error(data);
                });

                startedProcess.on('exit', (code, signal) => {
                    console.log(
                        `${tagName} server (${serviceName})-(${startedProcess.pid}) exited with code ${code} and signal ${signal}`
                    );
                    resolve({
                        status: 'not_running',
                        service: tagName,
                        action: 'start',
                        name: serviceName
                    });
                });
                startedProcess.on('close', (code, signal) => {
                    console.error(`${tagName} server (${serviceName})-(${startedProcess.pid}) closed with code ${code} and signal ${signal}`
                    );
                    resolve({
                        status: 'not_running',
                        service: tagName,
                        action: 'start',
                        name: serviceName
                    });
                });
                startedProcess.on('error', (error) => {
                    console.error(`${tagName} server (${serviceName})-(${startedProcess.pid}) exited with error: ${error}`);
                    resolve({
                        status: 'error',
                        service: tagName,
                        action: 'start',
                        name: serviceName,
                        error
                    });
                });
            };

            if (pid) {
                if (attemptRestart) {
                    // We have a running process, let's attempt to stop it first
                    //TODO Should be an await instead of then, which would remove the need for the inner doStart function
                    //const stopResponse = await
                    stopProcess(serviceName, tagName).then((stopResponse) => {
                        // If we failed at stopping the process, fail the start
                        if (stopResponse.status !== 'stopped') {
                            console.log(`could not restart ${tagName} server for ${serviceName}`);
                            resolve({
                                status: 'could_not_restart',
                                service: tagName,
                                name: serviceName
                            });
                            return;
                        }
                        doStart();
                    });
                } else {
                    // We don't want to restart, so fail the start call

                    console.log(`service ${tagName} already running (${serviceName})`);
                    resolve({
                        status: 'already_running',
                        service: tagName,
                        action: 'start',
                        name: serviceName
                    });
                    return;
                }
            } else {
                doStart();
            }
        });
    });
};

const stopProcess = async function (serviceName: string, tagName: string): Promise<any> {
    return new Promise((resolve) => {
        // Check if we have a process running for that serviceName
        // TODO Should be an await instead of then but need to rework the promise to make it work
        getServiceRunningPid(serviceName).then((pid) => {
            console.log(`Stopping ${tagName} service ${serviceName} with pid ${pid}`);

            if (pid) {
                try {
                    process.kill(pid);

                    let i = 0;

                    const waitForExit = function () {
                        if (!ProcessUtils.isPidRunning(pid)) {
                            const pidFilename = `${PID_DIRECTORY}/${serviceName}.pid`;
                            fileManager.deleteFile(pidFilename);
                            console.log(`${tagName} server (${serviceName} stopped (${i} check retry)`);
                            resolve({
                                status: 'stopped',
                                service: tagName,
                                name: serviceName
                            });
                        } else if (i >= 50) {
                            // TODO Make this timeout configurable somehow
                            // 5 seconds
                            const error = `${tagName} server (${serviceName} did not exit after 5 seconds`;
                            console.error(error);
                            resolve({
                                status: 'error',
                                service: tagName,
                                name: serviceName,
                                error
                            });
                        } else {
                            setTimeout(() => {
                                i++;
                                waitForExit();
                            }, 100);
                        }
                    };

                    waitForExit();
                } catch (error) {
                    // TODO Should we clean up the file if we get the exception. (It might also be a permission issue)
                    console.error(error);
                    console.log(`$(tagName) server (${serviceName}) not running (exception)`);
                    resolve({
                        status: 'not_running',
                        service: tagName,
                        name: serviceName
                    });
                    return;
                }
            } else {
                console.log(`${tagName} server (${serviceName}) not running`);
                resolve({
                    status: 'not_running',
                    service: tagName,
                    name: serviceName
                });
            }
        });
    });
};

export default {
    getServiceRunningPid,
    isServiceRunning,
    startProcess,
    stopProcess
};
