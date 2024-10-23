/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { getOsrmDirectoryPathForMode } from './OSRMServicePath';
import ProcessManager from './ProcessManager';
import { RoutingMode, routingModes } from 'chaire-lib-common/lib/config/routingModes';
import osrmService from '../osrm/OSRMService';
import OSRMMode from '../osrm/OSRMMode';
import ServerConfig from '../../config/ServerConfig';
import { setProjectConfiguration } from '../../config/server.config';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

const getServiceName = function (mode: RoutingMode = 'walking', port: number | null = 5000) {
    return `osrmMode__${mode}__port${port}`;
};

const routingModeIsAvailable = async function (routingMode: RoutingMode): Promise<boolean> {
    const osrmModeConfig = ServerConfig.getRoutingEngineConfigForMode(routingMode, 'osrmRouting');
    if (osrmModeConfig && osrmModeConfig.enabled === true && osrmModeConfig.autoStart !== true) {
        // Assume that an external OSRM is always available
        // TODO Do a "ping" check  on the service to be sure
        return true;
    }
    const port = osrmModeConfig.port;

    const serviceName = getServiceName(routingMode, port);

    // Get PID and ensure we clean up DB on stale data
    const pid = await ProcessManager.getServiceRunningPid(serviceName, true);
    if (pid !== null) {
        // DB has a valid PID
        return true;
    } else {
        // DB has no PID, which means there's no service running
        return false;
    }
};

const availableRoutingModes = async function (): Promise<RoutingMode[]> {
    const availableRoutingModes: RoutingMode[] = [];
    const osrmServerModes = ServerConfig.getAllModesForEngine('osrmRouting');
    for (const routingMode of osrmServerModes) {
        if (!routingModes.includes(routingMode as RoutingMode)) {
            console.log(`Mode ${routingMode} in osrmRouting preferences is not a routing mode, ignoring`);
            continue;
        }

        //TODO consider doing the calls in a promise.all()
        if (await routingModeIsAvailable(routingMode as RoutingMode)) {
            availableRoutingModes.push(routingMode as RoutingMode);
        }
    }
    console.log('Number of Available Routing Modes: ' + availableRoutingModes.length);
    return availableRoutingModes;
};

function errorConfiguringMode(mode: RoutingMode, message: string) {
    console.log('Error configuring OSRM mode ' + mode + ' ' + message);
    setProjectConfiguration({
        routing: {
            [mode]: {
                defaultEngine: 'osrmRouting',
                engines: {
                    osrmRouting: { enabled: false }
                }
            }
        } as any
    });
}

// FIXME This function should only have to be called by the main server thread, but it is also used by threads, without starting the servers
/* Will read the configuration file and configure the system to use
 all the OSRM mode described. Will either start the necessary process
 or attempt to connect to external ones */
const configureAllOsrmServers = async function (startServers = true): Promise<void> {
    const osrmModes = ServerConfig.getAllModesForEngine('osrmRouting');
    for (const routingModeStr of osrmModes) {
        const routingMode = routingModeStr as RoutingMode;
        const modeConfig = ServerConfig.getRoutingEngineConfigForMode(routingMode, 'osrmRouting');
        // TODO Do we want to accept camelCase equivalent of each routing modes?
        if (routingModes.includes(routingMode)) {
            // Only configure mode that are enabled
            if (modeConfig.enabled === true) {
                const port = modeConfig.port;
                // Use the host in the config even for local server starts as it allows to fine-tune the url to contact (for example ipv4 vs ipv6 names)
                const host = !_isBlank(modeConfig.host) ? modeConfig.host : '';

                if (port === null || port === undefined || port <= 0) {
                    errorConfiguringMode(routingMode, 'Invalid port number');
                    continue;
                }

                // Attempt to start process if requested
                // TODO Consider changing autoStart field name #1793
                if (modeConfig.autoStart === true) {
                    if (startServers) {
                        console.log('Starting OSRM Mode ' + routingMode);
                        const restartResponse = await restart({ mode: routingMode, port: port });
                        if (restartResponse.status !== 'started') {
                            errorConfiguringMode(routingMode, 'Cannot start local process');
                            continue;
                        }
                    } else {
                        console.log(`OSRM server for mode ${routingMode} configured to be started by main server`);
                    }
                } else {
                    console.log('Using external OSRM for mode ' + routingMode);
                }

                // Register OSRMMode object
                const mode = new OSRMMode(routingMode, host, port);
                osrmService.registerMode(routingMode, mode);
            } else {
                console.log('OSRM Mode ' + routingMode + ' is disabled');
            }
        } else {
            throw new Error(routingMode + ' is not a supported OSRMMode');
        }
    }
};

function getOsrmRoutedStartArgs(osrmDirectory: string, mode: string, port: string): string[] {
    return [
        osrmDirectory + `/${mode}.osrm`,
        `--max-table-size=100000 --max-matching-size=1000 --max-trip-size=1000 --max-viaroute-size=10000 -p${port}`
    ];
}

//TODO set type for parameters instead of any
//TODO set type for Promise return (in all the file)
const start = function (parameters = {} as any): Promise<any> {
    // TODO: Make the mode and port params mandatory
    const mode = parameters.mode || 'walking';
    const port = parameters.port || ServerConfig.getRoutingEngineConfigForMode(mode, 'osrmRouting').port;
    const serviceName = getServiceName(mode, port);
    const tagName = 'osrm';
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, parameters.directoryPrefix);

    return new Promise((resolve, reject) => {
        const command = 'osrm-routed';
        const commandArgs = getOsrmRoutedStartArgs(osrmDirectoryPath, mode, port);
        const waitString = 'running and waiting for requests';

        resolve(
            ProcessManager.startProcess({ serviceName, tagName, command, commandArgs, waitString, useShell: true })
        );
    });
};

const stop = function (parameters): Promise<any> {
    // TODO: Make the mode and port params mandatory
    const mode = parameters.mode || 'walking';
    const port = parameters.port || ServerConfig.getRoutingEngineConfigForMode(mode, 'osrmRouting').port;
    const serviceName = getServiceName(mode, port);
    const tagName = 'osrm';

    return new Promise((resolve, reject) => {
        resolve(ProcessManager.stopProcess(tagName, serviceName));
    });
};

const restart = function (parameters): Promise<any> {
    // TODO: Make the mode and port params mandatory
    const mode = parameters.mode || 'walking';
    const port = parameters.port || ServerConfig.getRoutingEngineConfigForMode(mode, 'osrmRouting').port;
    const serviceName = getServiceName(mode, port);
    const tagName = 'osrm';
    const osrmDirectoryPath = getOsrmDirectoryPathForMode(mode, parameters.directoryPrefix);

    return new Promise((resolve, reject) => {
        const command = 'osrm-routed';
        const commandArgs = getOsrmRoutedStartArgs(osrmDirectoryPath, mode, port);
        const waitString = 'running and waiting for requests';

        resolve(
            ProcessManager.startProcess({
                serviceName,
                tagName,
                command,
                commandArgs,
                waitString,
                useShell: true,
                attemptRestart: true
            })
        );
    });
};

export default {
    start,
    stop,
    restart,
    configureAllOsrmServers,
    routingModeIsAvailable,
    availableRoutingModes
};
