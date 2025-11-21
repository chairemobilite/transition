/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { EventEmitter } from 'events';
import { runEvolutionaryTransitNetworkDesignJob } from '../EvolutionaryTransitNetworkDesignJob';
import { ExecutableJob } from '../../../../executableJob/ExecutableJob';
import { EvolutionaryTransitNetworkDesignJobType } from '../types';

describe('EvolutionaryTransitNetworkDesignJob', () => {
    let mockJob: ExecutableJob<EvolutionaryTransitNetworkDesignJobType>;
    let mockProgressEmitter: EventEmitter;
    const mockIsCancelled = jest.fn().mockReturnValue(false) as jest.MockedFunction<Parameters<typeof runEvolutionaryTransitNetworkDesignJob>[1]['isCancelled']>;

    beforeEach(() => {
        mockJob = {} as ExecutableJob<EvolutionaryTransitNetworkDesignJobType>;
        mockProgressEmitter = new EventEmitter();
    });

    test.todo('should properly execute job with valid parameters');
    // FIXME Add more tests as required
});