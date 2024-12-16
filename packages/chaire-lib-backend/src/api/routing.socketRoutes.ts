/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
// This file contains socket routes to access the routing services
import { EventEmitter } from 'events';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import { validateAndCreateTripRoutingAttributes } from 'chaire-lib-common/lib/services/routing/RoutingAttributes';
import { TripRoutingQueryAttributes, RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { Routing } from '../services/routing/Routing';

//TODO: The userId parameter is unused. Either remove it or implement a use for it.
export default function (socket: EventEmitter, _userId: number) {
    socket.on(
        'routing.calculate',
        async (
            routingRequest: Partial<TripRoutingQueryAttributes>,
            callback: (status: Status.Status<RoutingResultsByMode>) => void
        ) => {
            try {
                const routingAttributes = validateAndCreateTripRoutingAttributes(routingRequest);
                // TODO Handle request cancellation
                const resultsByMode = await Routing.calculate(routingAttributes);
                callback(Status.createOk(resultsByMode));
            } catch (error) {
                console.error(error);
                callback(
                    Status.createError(
                        error instanceof Error ? error.message : 'Error occurred while calculating route'
                    )
                );
            }
        }
    );
}
