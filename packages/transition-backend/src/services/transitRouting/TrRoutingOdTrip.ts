/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { feature as turfFeature } from '@turf/turf';

import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { OdTripRouteResult } from './types';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { Routing } from 'chaire-lib-backend/lib/services/routing/Routing';
import { TransitRoutingQueryAttributes, RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';

interface RouteOdTripParameters {
    routing: TransitRoutingQueryAttributes;
    trRoutingPort?: number;
    reverseOD: boolean;
}

const routeOdTrip = async function (odTrip: BaseOdTrip, parameters: RouteOdTripParameters): Promise<OdTripRouteResult> {
    const routingAttributes = Object.assign({}, parameters.routing);
    // TODO Manage routing port in a better way
    (routingAttributes as any).routingPort = parameters.trRoutingPort;

    const origin = parameters.reverseOD ? odTrip.attributes.destination_geography : odTrip.attributes.origin_geography;
    const destination = parameters.reverseOD
        ? odTrip.attributes.origin_geography
        : odTrip.attributes.destination_geography;
    const uuid = odTrip.getId();
    const internalId = odTrip.attributes.internal_id || '';

    if (!origin || !origin.coordinates || !destination || !destination.coordinates) {
        return {
            uuid,
            internalId
        };
    }

    const originGeojson = turfFeature(origin);
    const destinationGeojson = turfFeature(destination);

    const tripQueryAttributes = {
        ...routingAttributes,
        originGeojson,
        destinationGeojson,
        timeSecondsSinceMidnight: odTrip.attributes.timeOfTrip,
        timeType: odTrip.attributes.timeType
    };

    try {
        const results: RoutingResultsByMode = await Routing.calculate(tripQueryAttributes);

        // We do not need the walkOnlyPath in the results, as it is already present in the other modes
        if (results.transit) {
            delete results.transit.walkOnlyPath;
        }

        return {
            uuid,
            internalId,
            origin,
            destination,
            results
        };
    } catch (error) {
        return {
            uuid,
            internalId,
            origin,
            destination,
            error: TrError.isTrError(error) ? error.export() : String(error)
        };
    }
};

export default routeOdTrip;
