/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { TrRoutingBatchManager } from '../TrRoutingBatchManager';
import TrRoutingProcessManager from 'chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager';
import MemcachedProcessManager, {
    MemcachedInstance
} from 'chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager';

jest.mock('chaire-lib-backend/lib/utils/processManagers/TrRoutingProcessManager', () => ({
    startBatch: jest.fn(),
    stopBatch: jest.fn()
}));

jest.mock('chaire-lib-backend/lib/utils/processManagers/MemcachedProcessManager', () => ({
    start: jest.fn()
}));

jest.mock('chaire-lib-backend/lib/config/server.config', () => ({
    maxParallelCalculators: 4
}));

const mockTrRoutingStartBatch = TrRoutingProcessManager.startBatch as jest.MockedFunction<
    typeof TrRoutingProcessManager.startBatch
>;
const mockTrRoutingStopBatch = TrRoutingProcessManager.stopBatch as jest.MockedFunction<
    typeof TrRoutingProcessManager.stopBatch
>;
const mockMemcachedStart = MemcachedProcessManager.start as jest.MockedFunction<typeof MemcachedProcessManager.start>;

describe('TrRoutingBatchManager', () => {
    let progressEmitter: EventEmitter;
    let mockMemcachedInstance: jest.Mocked<MemcachedInstance>;

    beforeEach(() => {
        jest.clearAllMocks();
        progressEmitter = new EventEmitter();

        // Create mock memcached instance
        mockMemcachedInstance = {
            getServer: jest.fn().mockReturnValue('localhost:11212'),
            status: jest.fn().mockResolvedValue('running'),
            stop: jest.fn().mockResolvedValue({ status: 'stopped' })
        } as unknown as jest.Mocked<MemcachedInstance>;

        // Default mock implementations
        mockTrRoutingStartBatch.mockResolvedValue({
            status: 'started',
            service: 'trRoutingBatch',
            port: 14000
        });
        mockTrRoutingStopBatch.mockResolvedValue({
            status: 'stopped',
            service: 'trRoutingBatch',
            port: 14000
        });
        mockMemcachedStart.mockResolvedValue(mockMemcachedInstance);
    });

    describe('startBatch', () => {
        test('should start memcached when no external server provided', async () => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            const result = await manager.startBatch(10);

            expect(result).toEqual({ threadCount: 4, port: 14000 });
            expect(mockMemcachedStart).toHaveBeenCalledTimes(1);
            expect(mockTrRoutingStartBatch).toHaveBeenCalledWith(4, {
                cacheDirectoryPath: undefined,
                memcachedServer: 'localhost:11212'
            });
        });

        test('should use memcached server from startBatch options', async () => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            const result = await manager.startBatch(10, {
                memcachedServer: 'options:11212'
            });

            expect(mockMemcachedStart).not.toHaveBeenCalled();
            expect(mockTrRoutingStartBatch).toHaveBeenCalledWith(4, {
                cacheDirectoryPath: undefined,
                memcachedServer: 'options:11212'
            });
        });

        test('should pass cacheDirectoryPath to TrRoutingProcessManager', async () => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(10, {
                cacheDirectoryPath: '/custom/cache/path'
            });

            expect(mockTrRoutingStartBatch).toHaveBeenCalledWith(4, {
                cacheDirectoryPath: '/custom/cache/path',
                memcachedServer: 'localhost:11212'
            });
        });

        test.each([
            { workload: 'small', size: 3, expectedSize: 1}, // Small workload: ceil(3/3) = 1
            { workload: 'medium', size: 9, expectedSize: 3}, // Medium workload: ceil(9/3) = 3
            { workload: 'large', size: 100, expectedSize: 4} // Large workload: min(4, ceil(100/3)) = 4 (capped at maxParallelCalculators)
        ])('should calculate thread count based on workload size ($workload)', async ({size, expectedSize}) => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(size);
            expect(mockTrRoutingStartBatch).toHaveBeenLastCalledWith(expectedSize, expect.anything());
        });

        test('should throw error when TrRouting fails to start', async () => {
            mockTrRoutingStartBatch.mockResolvedValue({
                status: 'error',
                service: 'trRoutingBatch',
                port: 14000
            } as any);

            const manager = new TrRoutingBatchManager(progressEmitter);

            await expect(manager.startBatch(10)).rejects.toThrow('Failed to start TrRouting instance: error');
        });

        test('should emit progress events', async () => {
            const progressEvents: any[] = [];
            progressEmitter.on('progress', (data) => progressEvents.push(data));

            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(10);

            expect(progressEvents).toEqual([
                { name: 'StartingRoutingParallelServer', progress: 0.0 },
                { name: 'StartingRoutingParallelServer', progress: 1.0 }
            ]);
        });

        test('should handle memcached start failure gracefully', async () => {
            mockMemcachedStart.mockResolvedValue(null);

            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(10);

            // Should still start TrRouting, but without memcached
            expect(mockTrRoutingStartBatch).toHaveBeenCalledWith(4, {
                cacheDirectoryPath: undefined,
                memcachedServer: undefined
            });
        });
    });

    describe('stopBatch', () => {
        test('should stop memcached when it was started by the manager', async () => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(10);
            await manager.stopBatch();

            expect(mockTrRoutingStopBatch).toHaveBeenCalledTimes(2); // Once in startBatch cleanup, once in stopBatch
            expect(mockMemcachedInstance.stop).toHaveBeenCalledTimes(1);
        });

        test('should not stop memcached when external server was used', async () => {
            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.startBatch(10, {
                memcachedServer: 'external:11211'
            });
            await manager.stopBatch();

            expect(mockTrRoutingStopBatch).toHaveBeenCalled();
            expect(mockMemcachedInstance.stop).not.toHaveBeenCalled();
        });

        test('should emit progress events', async () => {
            const progressEvents: Array<{ name: string; progress: number }> = [];
            progressEmitter.on('progress', (data) => progressEvents.push(data));

            const manager = new TrRoutingBatchManager(progressEmitter);

            await manager.stopBatch();

            expect(progressEvents).toContainEqual({ name: 'StoppingRoutingParallelServer', progress: 0.0 });
            expect(progressEvents).toContainEqual({ name: 'StoppingRoutingParallelServer', progress: 1.0 });
        });
    });
});
