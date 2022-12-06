/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
const isPidRunning = function (pid: number): boolean {
    // Inspired by is-running module
    try {
        process.kill(pid, 0);
    } catch (e) {
        return (e as any).code === 'EPERM';
    }
    return true;
};

export default {
    isPidRunning
};
