/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import ProcessManager from './ProcessManager';

const DEFAULT_PORT = 11212; // 11211 is the default memcached port, we use +1 to not clash
const TAG_NAME = 'memcached';

const getServiceName = function (port: number) {
    return `memcached${port}`;
};

/**
 * Represents a running memcached instance.
 * Use this object to get the server connection string and to stop the instance.
 */
export class MemcachedInstance {
    constructor(private port: number) {
        /* Nothing to do */
    }

    /**
     * Get the server connection string for this memcached instance.
     * @returns Server string in format 'localhost:port'
     */
    getServer(): string {
        return `localhost:${this.port}`;
    }

    /**
     * Check if the memcached instance is running.
     * @returns 'running' if the process is running, 'not_running' otherwise
     */
    async status(): Promise<'running' | 'not_running'> {
        const isRunning = await ProcessManager.isServiceRunning(getServiceName(this.port));
        return isRunning ? 'running' : 'not_running';
    }

    /**
     * Stop this memcached instance.
     * @returns Status of the stop operation
     */
    async stop(): Promise<{ status: 'stopped' | 'not_running' | 'error'; error?: unknown }> {
        return ProcessManager.stopProcess(getServiceName(this.port), TAG_NAME);
    }
}

/**
 * Start a memcached instance.
 *
 * @param options - Optional configuration
 * @param options.port - Port to run memcached on (default: 11212)
 * @returns A MemcachedInstance object if started successfully, null otherwise
 */
const start = async (options?: { port?: number }): Promise<MemcachedInstance | null> => {
    const port = options?.port ?? DEFAULT_PORT;

    const processStatus = await ProcessManager.startProcess({
        serviceName: getServiceName(port),
        tagName: TAG_NAME,
        command: 'memcached',
        commandArgs: [
            `--port=${port}`,
            '--user=nobody', // Memcached does not want to run as root, let's drop to nobody
            '-vv' // Enable detailed output for logging
        ],
        waitString: '',
        useShell: false,
        attemptRestart: false
    });

    if (processStatus.status === 'started') {
        return new MemcachedInstance(port);
    }

    if (processStatus.status === 'already_running') {
        // We treat already_running as an error since we don't know where this memcached
        // is managed and we have not idea of its lifecycle. It could disappear at any
        // moment.
        console.error('a memcached process already exist for port:', port);
    } else if (processStatus.status === 'error' && processStatus.error?.code === 'ENOENT') {
        console.error('memcached executable does not exist in path');
    } else {
        console.error('cannot start memcached:', processStatus);
    }

    return null;
};

export default { start };
