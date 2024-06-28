/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RoutingMode } from '../../config/routingModes';
import { default as routingServiceManager, DEFAULT_ROUTING_ENGINE } from './RoutingServiceManager';
import { RouteResults } from './RoutingService';
import { TripRoutingQueryAttributes } from './types';

/**
 * Calls the routing service to get a route between two points for a single mode
 * of calculation
 * @param { GeoJSON.Feature<GeoJSON.Point> } origin The origin point feature
 * @param { GeoJSON.Feature<GeoJSON.Point> } destination The destination point
 * feature
 * @param { RoutingMode }mode The mode of routing calculation, defaults to
 * 'walking'
 * @param { TripRoutingQueryAttributes | undefined } routingAttributes Optional
 * additional routing attributes for this trip calculation
 * @returns
 */
export const getRouteByMode = async (
    origin: GeoJSON.Feature<GeoJSON.Point>,
    destination: GeoJSON.Feature<GeoJSON.Point>,
    mode: RoutingMode = 'walking',
    routingAttributes?: TripRoutingQueryAttributes
): Promise<RouteResults> => {
    const routingService = routingServiceManager.getRoutingServiceForEngine(DEFAULT_ROUTING_ENGINE);
    const routingResult = await routingService.route({
        mode,
        points: { type: 'FeatureCollection', features: [origin, destination] },
        withAlternatives: routingAttributes?.withAlternatives || false
    });
    return routingResult;
};
