/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import osrm from 'osrm';

/*
Content of the osrm type can be found at
https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/osrm/index.d.ts
*/

import { RoutingMode } from '../config/routingModes';
import { TripRoutingQueryAttributes } from '../services/routing/types';

export interface TransitionMatchOptions extends osrm.MatchOptions {
    mode: RoutingMode;
    points: GeoJSON.Feature<GeoJSON.Point>[];
}

export interface TransitionRouteOptions extends osrm.RouteOptions {
    mode: RoutingMode;
    points: GeoJSON.Feature<GeoJSON.Point>[];
    routingAttributes?: TripRoutingQueryAttributes;
    withAlternatives?: boolean;
}
