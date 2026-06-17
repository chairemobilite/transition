/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import AgencyCollection from '../../agency/AgencyCollection';
import LineCollection from '../../line/LineCollection';
import ServiceCollection from '../../service/ServiceCollection';

/**
 * Simulation algorithm class. This will actually run the algorithm
 *
 * @export
 * @interface TransitNetworkDesignAlgorithm
 */
// This interface used to have a type variable <T> that was documented as "The type of options".
// This was completely unused so it was removed, but a comment is left here in case we ever want to implement it again.
export interface TransitNetworkDesignAlgorithm {
    run: (
        socket: EventEmitter,
        collections: { lines: LineCollection; agencies: AgencyCollection; services: ServiceCollection }
    ) => Promise<boolean>;
}
