/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { RoutingMode } from '../../config/routingModes';
import { default as routingServiceManager, DEFAULT_ROUTING_ENGINE } from './RoutingServiceManager';
import { RouteResults } from './RoutingService';

export const getRouteByMode = async (
    origin: GeoJSON.Feature<GeoJSON.Point>,
    destination: GeoJSON.Feature<GeoJSON.Point>,
    mode: RoutingMode = 'walking'
): Promise<RouteResults> => {
    const routingService = routingServiceManager.getRoutingServiceForEngine(DEFAULT_ROUTING_ENGINE);
    const routingResult = await routingService.route({
        mode,
        points: { type: 'FeatureCollection', features: [origin, destination] }
    });
    return routingResult;
};
