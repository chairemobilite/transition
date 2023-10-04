/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { feature as turfFeature } from '@turf/turf';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    TransitRoutingCalculator,
    ResultsByMode
} from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { OdTripRouteResult } from './types';
import TrError from 'chaire-lib-common/lib/utils/TrError';
// TODO Should this file go in the backend?

interface RouteOdTripParameters {
    routing: TransitRouting;
    trRoutingPort?: number;
    odTripIndex: number;
    odTripsCount: number;
    reverseOD: boolean;
    /**
     * The collection of paths used in the scenario, required only if the
     * geojson geometries are to be calculated
     *
     * @type {PathCollection}
     * @memberof RouteOdTripParameters
     */
    pathCollection?: PathCollection;
}

const routeOdTrip = async function (odTrip: BaseOdTrip, parameters: RouteOdTripParameters): Promise<OdTripRouteResult> {
    const routingAttributes: TransitRoutingAttributes = Object.assign({}, parameters.routing.getAttributes());
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

    routingAttributes.originGeojson = originGeojson;
    routingAttributes.destinationGeojson = destinationGeojson;

    routingAttributes.arrivalTimeSecondsSinceMidnight =
        odTrip.attributes.timeType === 'arrival' ? odTrip.attributes.timeOfTrip : undefined;
    routingAttributes.departureTimeSecondsSinceMidnight =
        odTrip.attributes.timeType === 'departure' ? odTrip.attributes.timeOfTrip : undefined;

    try {
        const results: ResultsByMode = await TransitRoutingCalculator.calculate(
            new TransitRouting(routingAttributes),
            false
        );

        if (results.transit) {
            delete results.transit.getParams().walkOnlyPath;
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
