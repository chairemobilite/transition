/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';

import { ExecutableJob } from '../../services/executableJob/ExecutableJob';
import type { NodeAccessibilityWeightingJobType } from '../../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingJobType';
import {
    executeNodeAccessibilityWeighting,
    enrichNodeWeightsCsvOnDisk,
    loadPartialCheckpointBundle,
    removePartialWeightsFile,
    resolveWeightsFilePath
} from '../../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingService';
import {
    emitNodeAccessibilityPauseAtChunkBoundary,
    wrapNodeAccessibilityWeighting,
    type WorkerHelpers
} from '../nodeAccessibilityWeightingWorkerTask';

jest.mock('../../services/executableJob/ExecutableJob', () => {
    const MockExecutableJob = jest.fn();
    (MockExecutableJob as any).loadTask = jest.fn();
    (MockExecutableJob as any).getJobStatus = jest.fn().mockResolvedValue('inProgress');
    return { ExecutableJob: MockExecutableJob };
});

jest.mock('../../services/nodes/nodeAccessibilityWeighting/NodeAccessibilityWeightingService', () => ({
    executeNodeAccessibilityWeighting: jest.fn(),
    enrichNodeWeightsCsvOnDisk: jest.fn().mockResolvedValue(undefined),
    enrichedWeightsFilenameForJob: jest.fn((id: number) => `node_weights_enriched_${id}.csv`),
    loadPartialCheckpointBundle: jest.fn().mockReturnValue({ weights: new Map(), intrinsicPointsProcessed: 0 }),
    removePartialWeightsFile: jest.fn(),
    resolveWeightsFilePath: jest.fn(),
    savePartialWeightsMapAtomic: jest.fn(),
    weightsFilenameForJob: jest.fn((id: number) => `node_weights_${id}.csv`)
}));

const mockExecute = executeNodeAccessibilityWeighting as jest.MockedFunction<typeof executeNodeAccessibilityWeighting>;
const mockEnrich = enrichNodeWeightsCsvOnDisk as jest.MockedFunction<typeof enrichNodeWeightsCsvOnDisk>;
const mockResolveWeightsPath = resolveWeightsFilePath as jest.MockedFunction<typeof resolveWeightsFilePath>;
const mockLoadCheckpoint = loadPartialCheckpointBundle as jest.MockedFunction<typeof loadPartialCheckpointBundle>;
const mockRemovePartial = removePartialWeightsFile as jest.MockedFunction<typeof removePartialWeightsFile>;

const JOB_DIR = '/test/jobs/99';
const JOB_ID = 99;

const baseConfig = {
    weightingInputType: 'poi' as const,
    maxWalkingTimeSeconds: 1200,
    decayFunctionParameters: { type: 'power' as const, beta: 1.5 },
    weightingFileMapping: { pointLat: 'lat', pointLon: 'lon' }
};

function createMockTask(overrides: Record<string, unknown> = {}) {
    return {
        setInProgress: jest.fn(),
        setCompleted: jest.fn(),
        setFailed: jest.fn(),
        setPaused: jest.fn(),
        save: jest.fn().mockResolvedValue(true),
        refresh: jest.fn().mockResolvedValue(true),
        getJobFileDirectory: jest.fn().mockReturnValue(JOB_DIR),
        registerOutputFile: jest.fn(),
        status: 'inProgress',
        attributes: {
            id: JOB_ID,
            user_id: 1,
            name: 'nodeAccessibilityWeighting',
            data: { parameters: { config: baseConfig } },
            internal_data: {},
            ...overrides
        }
    } as unknown as ExecutableJob<NodeAccessibilityWeightingJobType>;
}

function createHelpers(): WorkerHelpers {
    return {
        newProgressEmitter: jest.fn().mockReturnValue(new EventEmitter()),
        getTaskCancelledFct: jest.fn().mockReturnValue(() => false)
    };
}

describe('wrapNodeAccessibilityWeighting', () => {
    let taskListener: EventEmitter;

    beforeEach(() => {
        jest.clearAllMocks();
        taskListener = new EventEmitter();
        mockLoadCheckpoint.mockReturnValue({ weights: new Map(), intrinsicPointsProcessed: 0 });
    });

    test('successful completion enriches output and registers file', async () => {
        const task = createMockTask();
        const helpers = createHelpers();
        mockExecute.mockResolvedValue({
            pointCount: 100,
            nodeCount: 50,
            nodesWithWeight: 45,
            finishedNormally: true
        });
        mockResolveWeightsPath.mockReturnValue(`${JOB_DIR}/node_weights_${JOB_ID}.csv`);

        const result = await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        expect(result).toBe('completed');
        expect(mockRemovePartial).toHaveBeenCalledWith(JOB_DIR);
        expect(mockEnrich).toHaveBeenCalledWith(
            `${JOB_DIR}/node_weights_${JOB_ID}.csv`,
            `${JOB_DIR}/node_weights_enriched_${JOB_ID}.csv`
        );
        expect(task.registerOutputFile).toHaveBeenCalledWith('output', `node_weights_enriched_${JOB_ID}.csv`);
        expect(task.attributes.data.results).toEqual({
            pointCount: 100,
            nodeCount: 50,
            nodesWithWeight: 45
        });
        expect(task.save).toHaveBeenCalled();
    });

    test('falls back to raw filename when raw weights file is missing', async () => {
        const task = createMockTask();
        const helpers = createHelpers();
        mockExecute.mockResolvedValue({
            pointCount: 10,
            nodeCount: 5,
            nodesWithWeight: 3,
            finishedNormally: true
        });
        mockResolveWeightsPath.mockReturnValue(undefined);

        const result = await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        expect(result).toBe('completed');
        expect(mockEnrich).not.toHaveBeenCalled();
        expect(task.registerOutputFile).toHaveBeenCalledWith('output', `node_weights_${JOB_ID}.csv`);
    });

    test('returns paused and emits boundary signal when job is paused', async () => {
        const task = createMockTask();
        (task as any).status = 'paused';
        const helpers = createHelpers();
        const emitter = new EventEmitter();
        const emitSpy = jest.spyOn(emitter, 'emit');
        (helpers.newProgressEmitter as jest.Mock).mockReturnValue(emitter);
        mockExecute.mockResolvedValue({
            pointCount: 50,
            nodeCount: 50,
            nodesWithWeight: 0,
            finishedNormally: false
        });

        const result = await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        expect(result).toBe('paused');
        expect(emitSpy).toHaveBeenCalledWith(
            'progress',
            expect.objectContaining({ pauseAtChunkBoundary: true, jobId: JOB_ID })
        );
    });

    test('cleans up and returns failed when job is cancelled', async () => {
        const task = createMockTask();
        (task as any).status = 'cancelled';
        const helpers = createHelpers();
        mockExecute.mockResolvedValue({
            pointCount: 50,
            nodeCount: 50,
            nodesWithWeight: 0,
            finishedNormally: false
        });

        const result = await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        expect(result).toBe('failed');
        expect(mockRemovePartial).toHaveBeenCalledWith(JOB_DIR);
        expect(task.save).toHaveBeenCalled();
    });

    test('throws when config is missing', async () => {
        const task = createMockTask({ data: { parameters: {} } });
        const helpers = createHelpers();

        await expect(wrapNodeAccessibilityWeighting(task, taskListener, helpers)).rejects.toThrow(
            'Job has incomplete configuration'
        );
    });

    test('resumes from checkpoint with existing partial weights', async () => {
        const existingWeights = new Map([['node-1', 2.5]]);
        mockLoadCheckpoint.mockReturnValue({ weights: existingWeights, intrinsicPointsProcessed: 30 });
        const task = createMockTask({ internal_data: { checkpoint: 25 } });
        const helpers = createHelpers();
        mockExecute.mockResolvedValue({
            pointCount: 100,
            nodeCount: 50,
            nodesWithWeight: 45,
            finishedNormally: true
        });
        mockResolveWeightsPath.mockReturnValue(`${JOB_DIR}/node_weights_${JOB_ID}.csv`);

        await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        const executeCall = mockExecute.mock.calls[0];
        const options = executeCall[3];
        expect(options?.resumePointsProcessed).toBe(30);
        expect(options?.resumeWeights).toBe(existingWeights);
    });

    test('restarts from scratch when checkpoint exists but partial weights are empty', async () => {
        mockLoadCheckpoint.mockReturnValue({ weights: new Map(), intrinsicPointsProcessed: 0 });
        const task = createMockTask({ internal_data: { checkpoint: 50 } });
        const helpers = createHelpers();
        mockExecute.mockResolvedValue({
            pointCount: 100,
            nodeCount: 50,
            nodesWithWeight: 45,
            finishedNormally: true
        });
        mockResolveWeightsPath.mockReturnValue(`${JOB_DIR}/node_weights_${JOB_ID}.csv`);

        await wrapNodeAccessibilityWeighting(task, taskListener, helpers);

        const executeCall = mockExecute.mock.calls[0];
        const options = executeCall[3];
        expect(options?.resumePointsProcessed).toBeUndefined();
        expect(options?.resumeWeights).toBeUndefined();
        expect(task.save).toHaveBeenCalled();
    });
});

describe('emitNodeAccessibilityPauseAtChunkBoundary', () => {
    test('emits pause signal for weighting jobs', () => {
        const emitter = new EventEmitter();
        const emitSpy = jest.spyOn(emitter, 'emit');
        const helpers = createHelpers();
        (helpers.newProgressEmitter as jest.Mock).mockReturnValue(emitter);
        const task = { attributes: { id: 42, name: 'nodeAccessibilityWeighting' } } as any;

        emitNodeAccessibilityPauseAtChunkBoundary(task, helpers);

        expect(emitSpy).toHaveBeenCalledWith(
            'progress',
            expect.objectContaining({
                pauseAtChunkBoundary: true,
                jobId: 42,
                progress: -1
            })
        );
    });

    test('does nothing for non-weighting jobs', () => {
        const helpers = createHelpers();
        const task = { attributes: { id: 42, name: 'batchRoute' } } as any;

        emitNodeAccessibilityPauseAtChunkBoundary(task, helpers);

        expect(helpers.newProgressEmitter).not.toHaveBeenCalled();
    });
});
