/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { ExecutableJob } from '../../services/executableJob/ExecutableJob';
import { BatchRouteJobType } from '../../services/transitRouting/BatchRoutingJob';
import { batchRoute } from '../../services/transitRouting/TrRoutingBatch';
import { batchAccessibilityMap } from '../../services/transitRouting/TrAccessibilityMapBatch';
import Users from 'chaire-lib-backend/lib/services/users/users';
import { EventEmitter } from 'events';
import { wrapTaskExecution } from '../TransitionWorkerPool';

// Mock dependencies
jest.mock('workerpool', () => ({
  worker: jest.fn(),
  workerEmit: jest.fn()
}));
jest.mock('../../services/transitRouting/TrRoutingBatch', () => ({
    batchRoute: jest.fn()
}));
const mockBatchRoute = batchRoute as jest.MockedFunction<typeof batchRoute>;
jest.mock('../../services/transitRouting/TrAccessibilityMapBatch');
jest.mock('../../scripts/prepareProcessRoutes', () => jest.fn());
jest.mock('chaire-lib-backend/lib/services/users/users', () => ({
    getUserDiskUsage: jest.fn().mockReturnValue({ remaining: 1000 }) // Mock disk usage
}));
const mockDiskUsage = Users.getUserDiskUsage as jest.MockedFunction<typeof Users.getUserDiskUsage>;
jest.mock('../../services/executableJob/ExecutableJob', () => {
    // Mock class constructor
    const MockExecutableJob = jest.fn().mockImplementation(() => {
        return {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue('/test/dir'),
            attributes: {}
        };
    });
    
    // Static methods
    (MockExecutableJob as any).loadTask = jest.fn();
    
    return { ExecutableJob: MockExecutableJob };
});
const mockLoadTask = ExecutableJob.loadTask as jest.MockedFunction<typeof ExecutableJob.loadTask>;  

describe('batch route execution', () => {
    const userDir = '/test/dir';
    
    beforeEach(() => {   
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.useRealTimers();
    });
    
    test('wrapTaskExecution should execute pending batch routing, with success, and update task', async () => {
        // Prepare test data
        const mockedTask = {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue(userDir),
            status: 'pending',
            attributes: {
                id: 34,
                user_id: 1,
                name: 'batchRoute',
                status: 'pending',
                data: {
                    parameters: {
                        demandAttributes: { type: 'csv' } as any,
                        transitRoutingAttributes: { routingModes: 'transit' } as any
                    }
                },
                internal_data: {},
                resources: {
                    files: { input: 'file.csv' }
                }
            }
        } as any;
        // The task that will be modified by the job function
        const updatableTask = _cloneDeep(mockedTask);
        mockLoadTask.mockResolvedValueOnce(updatableTask);
        const batchRouteResult = {
            calculationName: 'calculation',
            detailed: true,
            completed: true,
            errors: [],
            warnings: ['warning1', 'warning2'],
            files: { input: 'file.csv', csv: 'results.csv', detailedCsv: 'detailed.csv', geojson: 'geo.json' }
        }
        mockBatchRoute.mockResolvedValueOnce(batchRouteResult);

        // Run the test
        await wrapTaskExecution(mockedTask.attributes.id);

        // Verify task parameter and results update after the task
        expect(updatableTask.attributes.data.parameters).toEqual(mockedTask.attributes.data.parameters);
        expect(updatableTask.attributes.data.results).toEqual({
            calculationName: 'calculation',
            detailed: true,
            completed: true,
            warnings: ['warning1', 'warning2'],
            errors: []
        });
        expect(updatableTask.attributes.resources).toEqual({ files: batchRouteResult.files });
        
        // Verify batchRoute was called with correct parameters
        expect(mockBatchRoute).toHaveBeenCalledWith(
            mockedTask.attributes.data.parameters.demandAttributes,
            mockedTask.attributes.data.parameters.transitRoutingAttributes,
            expect.objectContaining({
                jobId: mockedTask.attributes.id,
                absoluteBaseDirectory: userDir,
                inputFileName: mockedTask.attributes.resources.files.input,
                isCancelled: expect.any(Function),
                currentCheckpoint: undefined,
                progressEmitter: expect.any(EventEmitter)
            })
        );
        // Verify function calls
        expect(mockLoadTask).toHaveBeenCalledWith(mockedTask.attributes.id);
        expect(mockDiskUsage).toHaveBeenCalledWith(mockedTask.attributes.user_id);
        
        // Verify task life cycle functions
        expect(updatableTask.setCompleted).toHaveBeenCalled();
        expect(updatableTask.setFailed).not.toHaveBeenCalled();
        expect(updatableTask.setInProgress).toHaveBeenCalled();
        expect(updatableTask.save).toHaveBeenCalledTimes(2); // One for in progress, one for completed

    });
    
    test('wrapTaskExecution should execute pending batch routing, with too many errors and update task', async () => {
        // Prepare test data
        const mockedTask = {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue(userDir),
            status: 'pending',
            attributes: {
                id: 34,
                user_id: 1,
                name: 'batchRoute',
                status: 'pending',
                data: {
                    parameters: {
                        demandAttributes: { type: 'csv' } as any,
                        transitRoutingAttributes: { routingModes: 'transit' } as any
                    }
                },
                internal_data: {},
                resources: {
                    files: { input: 'file.csv' }
                }
            }
        } as any;
        // The task that will be modified by the job function
        const updatableTask = _cloneDeep(mockedTask);
        mockLoadTask.mockResolvedValueOnce(updatableTask);
        const batchRouteResult = {
            calculationName: 'failed reading',
            detailed: false,
            completed: false,
            errors: ['error1', 'error2'],
            warnings: [],
            files: { input: 'file.csv' }
        }
        mockBatchRoute.mockResolvedValueOnce(batchRouteResult);

        // Run the test
        await wrapTaskExecution(mockedTask.attributes.id);

        // Verify task parameter and results update after the task
        expect(updatableTask.attributes.data.parameters).toEqual(mockedTask.attributes.data.parameters);
        expect(updatableTask.attributes.data.results).toEqual({
            calculationName: 'failed reading',
            detailed: false,
            completed: false,
            warnings: [],
            errors: ['error1', 'error2']
        });
        expect(updatableTask.attributes.resources).toEqual({ files: batchRouteResult.files });
        
        // Verify batchRoute was called with correct parameters
        expect(mockBatchRoute).toHaveBeenCalledWith(
            mockedTask.attributes.data.parameters.demandAttributes,
            mockedTask.attributes.data.parameters.transitRoutingAttributes,
            expect.objectContaining({
                jobId: mockedTask.attributes.id,
                absoluteBaseDirectory: userDir,
                inputFileName: mockedTask.attributes.resources.files.input,
                isCancelled: expect.any(Function),
                currentCheckpoint: undefined,
                progressEmitter: expect.any(EventEmitter)
            })
        );
        // Verify function calls
        expect(mockLoadTask).toHaveBeenCalledWith(mockedTask.attributes.id);
        expect(mockDiskUsage).toHaveBeenCalledWith(mockedTask.attributes.user_id);
        
        // Verify task life cycle functions
        expect(updatableTask.setCompleted).not.toHaveBeenCalled();
        expect(updatableTask.setFailed).toHaveBeenCalled();
        expect(updatableTask.setInProgress).toHaveBeenCalled();
        expect(updatableTask.save).toHaveBeenCalledTimes(2); // One for in progress, one for completed
    });

    test('wrapTaskExecution should not execute pending batch routing if disk quota is reached, and update task', async () => {
        // Prepare test data
        mockDiskUsage.mockReturnValueOnce({ used: 1000, remaining: 0 }); // Simulate no disk space left
        const mockedTask = {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue(userDir),
            status: 'pending',
            attributes: {
                id: 34,
                user_id: 1,
                name: 'batchRoute',
                status: 'pending',
                data: {
                    parameters: {
                        demandAttributes: { type: 'csv' } as any,
                        transitRoutingAttributes: { routingModes: 'transit' } as any
                    }
                },
                internal_data: {},
                resources: {
                    files: { input: 'file.csv' }
                }
            }
        } as any;
        // The task that will be modified by the job function
        const updatableTask = _cloneDeep(mockedTask);
        mockLoadTask.mockResolvedValueOnce(updatableTask);
    
        // Run the test
        await wrapTaskExecution(mockedTask.attributes.id);

        // Verify batchRoute was called with correct parameters
        expect(mockBatchRoute).not.toHaveBeenCalled();
        // Verify function calls
        expect(mockLoadTask).toHaveBeenCalledWith(mockedTask.attributes.id);
        expect(mockDiskUsage).toHaveBeenCalledWith(mockedTask.attributes.user_id);

        // Verify task parameter and results update after the task
        expect(updatableTask.attributes.data.parameters).toEqual(mockedTask.attributes.data.parameters);
        expect(updatableTask.attributes.data.results).toBeUndefined();
        expect(updatableTask.attributes.resources).toEqual(mockedTask.attributes.resources);
        
        // Verify task life cycle functions
        expect(updatableTask.setCompleted).not.toHaveBeenCalled();
        expect(updatableTask.setFailed).toHaveBeenCalled();
        expect(updatableTask.setInProgress).toHaveBeenCalled();
        expect(updatableTask.save).toHaveBeenCalledTimes(2); // One for in progress, one for completed

    });

    test('wrapTaskExecution should execute an in progress batch routing task, and update task at the end', async () => {
        // Prepare test data
        const mockedTask = {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue(userDir),
            status: 'inProgress',
            attributes: {
                id: 34,
                user_id: 1,
                name: 'batchRoute',
                status: 'pending',
                data: {
                    parameters: {
                        demandAttributes: { type: 'csv' } as any,
                        transitRoutingAttributes: { routingModes: 'transit' } as any
                    }
                },
                internal_data: { checkpoint: 10 },
                resources: {
                    files: { input: 'file.csv' }
                }
            }
        } as any;
        // The task that will be modified by the job function
        const updatableTask = _cloneDeep(mockedTask);
        mockLoadTask.mockResolvedValueOnce(updatableTask);
        const batchRouteResult = {
            calculationName: 'calculation',
            detailed: true,
            completed: true,
            errors: [],
            warnings: ['warning1', 'warning2'],
            files: { input: 'file.csv', csv: 'results.csv', detailedCsv: 'detailed.csv', geojson: 'geo.json' }
        }
        mockBatchRoute.mockResolvedValueOnce(batchRouteResult);

        // Run the test
        await wrapTaskExecution(mockedTask.attributes.id);

        // Verify task parameter and results update after the task
        expect(updatableTask.attributes.data.parameters).toEqual(mockedTask.attributes.data.parameters);
        expect(updatableTask.attributes.data.results).toEqual({
            calculationName: 'calculation',
            detailed: true,
            completed: true,
            warnings: ['warning1', 'warning2'],
            errors: []
        });
        expect(updatableTask.attributes.resources).toEqual({ files: batchRouteResult.files });
        
        // Verify batchRoute was called with correct parameters
        expect(mockBatchRoute).toHaveBeenCalledWith(
            mockedTask.attributes.data.parameters.demandAttributes,
            mockedTask.attributes.data.parameters.transitRoutingAttributes,
            expect.objectContaining({
                jobId: mockedTask.attributes.id,
                absoluteBaseDirectory: userDir,
                inputFileName: mockedTask.attributes.resources.files.input,
                isCancelled: expect.any(Function),
                currentCheckpoint: mockedTask.attributes.internal_data.checkpoint,
                progressEmitter: expect.any(EventEmitter)
            })
        );
        // Verify function calls
        expect(mockLoadTask).toHaveBeenCalledWith(mockedTask.attributes.id);
        expect(mockDiskUsage).toHaveBeenCalledWith(mockedTask.attributes.user_id);
        
        // Verify task life cycle functions
        expect(updatableTask.setCompleted).toHaveBeenCalled();
        expect(updatableTask.setFailed).not.toHaveBeenCalled();
        expect(updatableTask.setInProgress).toHaveBeenCalled();
        expect(updatableTask.save).toHaveBeenCalledTimes(2); // One for in progress, one for completed
    });

    test('wrapTaskExecution should not execute cancelled task', async () => {
        // Prepare test data
        mockDiskUsage.mockReturnValueOnce({ used: 1000, remaining: 0 }); // Simulate no disk space left
        const mockedTask = {
            // Instance methods
            setInProgress: jest.fn(),
            setCompleted: jest.fn(),
            setFailed: jest.fn(),
            save: jest.fn().mockResolvedValue(true),
            refresh: jest.fn().mockResolvedValue(true),
            getJobFileDirectory: jest.fn().mockReturnValue(userDir),
            status: 'cancelled',
            attributes: {
                id: 34,
                user_id: 1,
                name: 'batchRoute',
                status: 'cancelled',
                data: {
                    parameters: {
                        demandAttributes: { type: 'csv' } as any,
                        transitRoutingAttributes: { routingModes: 'transit' } as any
                    }
                },
                internal_data: { checkpoint: 10 },
                resources: {
                    files: { input: 'file.csv' }
                }
            }
        } as any;
        // The task that will be modified by the job function
        const updatableTask = _cloneDeep(mockedTask);
        mockLoadTask.mockResolvedValueOnce(updatableTask);

        // Run the test
        await wrapTaskExecution(mockedTask.attributes.id);

        // Verify batchRoute was called with correct parameters
        expect(mockBatchRoute).not.toHaveBeenCalled();
        // Verify function calls
        expect(mockLoadTask).toHaveBeenCalledWith(mockedTask.attributes.id);
        expect(mockDiskUsage).not.toHaveBeenCalled();

        // Verify task life cycle functions
        expect(updatableTask.setCompleted).not.toHaveBeenCalled();
        expect(updatableTask.setFailed).not.toHaveBeenCalled();
        expect(updatableTask.setInProgress).not.toHaveBeenCalled();
        expect(updatableTask.save).not.toHaveBeenCalled();

    });
});