/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { TransitNetworkDesignJobWrapper } from '../TransitNetworkDesignJobWrapper';
import { TransitNetworkDesignJobType } from '../types';
import { ExecutableJob } from '../../../executableJob/ExecutableJob';
import LineCollection from 'transition-common/lib/services/line/LineCollection';
import AgencyCollection from 'transition-common/lib/services/agency/AgencyCollection';
import ServiceCollection from 'transition-common/lib/services/service/ServiceCollection';
import { LineServices } from '../../../evolutionaryAlgorithm/internalTypes';

/**
 * Mock implementation of TransitNetworkDesignJobWrapper for testing purposes.
 * Allows tests to provide controlled data without actual server loading or cache preparation.
 */
export class MockTransitNetworkDesignJobWrapper<TJobType extends TransitNetworkDesignJobType = TransitNetworkDesignJobType> 
    extends TransitNetworkDesignJobWrapper<TJobType> {
    
    private mockLineCollection: LineCollection | undefined;
    private mockAgencyCollection: AgencyCollection | undefined;
    private mockServiceCollection: ServiceCollection | undefined;
    private mockCacheDirectory: string = '/tmp/test-cache';

    constructor(wrappedJob: ExecutableJob<TJobType>, executorOptions: {
        progressEmitter: EventEmitter;
        isCancelled: () => boolean;
    }) {
        super(wrappedJob, executorOptions);
    }

    /**
     * Set the mock data that will be returned by the getter methods
     */
    setMockData(data: {
        lineCollection?: LineCollection;
        agencyCollection?: AgencyCollection;
        serviceCollection?: ServiceCollection;
        simulatedLineCollection?: LineCollection;
        lineServices?: LineServices;
        cacheDirectory?: string;
    }): void {
        if (data.lineCollection) {
            this.mockLineCollection = data.lineCollection;
        }
        if (data.agencyCollection) {
            this.mockAgencyCollection = data.agencyCollection;
        }
        if (data.serviceCollection) {
            this.mockServiceCollection = data.serviceCollection;
        }
        if (data.simulatedLineCollection) {
            this.simulatedLineCollection = data.simulatedLineCollection;
        }
        if (data.lineServices) {
            this.setLineServices(data.lineServices);
        }
        if (data.cacheDirectory) {
            this.mockCacheDirectory = data.cacheDirectory;
        }
    }

    // Override getter methods to return mock data
    get allLineCollection(): LineCollection {
        if (this.mockLineCollection === undefined) {
            throw new Error('Mock line collection not set. Call setMockData() first.');
        }
        return this.mockLineCollection;
    }

    get agencyCollection(): AgencyCollection {
        if (this.mockAgencyCollection === undefined) {
            throw new Error('Mock agency collection not set. Call setMockData() first.');
        }
        return this.mockAgencyCollection;
    }

    get serviceCollection(): ServiceCollection {
        if (this.mockServiceCollection === undefined) {
            throw new Error('Mock service collection not set. Call setMockData() first.');
        }
        return this.mockServiceCollection;
    }

    getCacheDirectory = (): string => {
        return this.mockCacheDirectory;
    }

    // Override methods that perform actual server operations to be no-ops for testing
    loadServerData = jest.fn().mockResolvedValue(undefined);
    prepareCacheDirectory = jest.fn();
}

/**
 * Factory function to create a mock job executor with default test data
 */
export const createMockJobExecutor = <TJobType extends TransitNetworkDesignJobType = TransitNetworkDesignJobType>(
    job: ExecutableJob<TJobType>,
    mockData?: {
        lineCollection?: LineCollection;
        agencyCollection?: AgencyCollection;
        serviceCollection?: ServiceCollection;
        simulatedLineCollection?: LineCollection;
        lineServices?: LineServices;
        cacheDirectory?: string;
    }
): MockTransitNetworkDesignJobWrapper<TJobType> => {
    const executor = new MockTransitNetworkDesignJobWrapper(job, {
        progressEmitter: new EventEmitter(),
        isCancelled: () => false
    });

    if (mockData) {
        executor.setMockData(mockData);
    }

    return executor;
};
