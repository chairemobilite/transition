/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type osrm from 'osrm';

/*
Content of the osrm type can be found at
https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/osrm/index.d.ts
*/

import type { RoutingMode } from '../config/routingModes';
import type { TripRoutingQueryAttributes } from '../services/routing/types';

/**
 * Options of a match query. The geometries of the results are always GeoJSON,
 * so the `geometries` option cannot be set.
 */
export interface TransitionMatchOptions extends Omit<osrm.MatchOptions, 'geometries'> {
    mode: RoutingMode;
    points: GeoJSON.Feature<GeoJSON.Point>[];
}

/**
 * Options of a route query. The geometries of the results are always GeoJSON,
 * so the `geometries` option cannot be set.
 */
export interface TransitionRouteOptions extends Omit<osrm.RouteOptions, 'geometries'> {
    mode: RoutingMode;
    points: GeoJSON.Feature<GeoJSON.Point>[];
    routingAttributes?: TripRoutingQueryAttributes;
    withAlternatives?: boolean;
}
