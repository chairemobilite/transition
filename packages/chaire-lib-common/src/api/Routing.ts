/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import type osrm from 'osrm';
import type * as Valhalla from './Valhalla';

/*
Content of the osrm type can be found at
https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/osrm/index.d.ts
*/

import type { RoutingMode } from '../config/routingModes';
import type { TripRoutingQueryAttributes } from '../services/routing/types';

interface TransitionRoutingOptions {
    mode: RoutingMode;
    points: GeoJSON.Feature<GeoJSON.Point>[];
    routingAttributes?: TripRoutingQueryAttributes;
    withAlternatives?: boolean;
}

/**
 * Options of a match query. The geometries of the results are always GeoJSON,
 * so the `geometries` option cannot be set.
 */
export type OSRMMatchOptions = TransitionRoutingOptions & Omit<osrm.MatchOptions, 'geometries'>;
export type ValhallaMatchOptions = TransitionRoutingOptions & Valhalla.ValhallaMatchOptions;
export type ValhallaIsochroneOptions = Valhalla.ValhallaIsochroneOptions & { mode: RoutingMode };

/**
 * Options of a route query. The geometries of the results are always GeoJSON,
 * so the `geometries` option cannot be set.
 */
export type ValhallaRouteOptions = TransitionRoutingOptions & Valhalla.ValhallaRouteOptions;
export type OSRMRouteOptions = TransitionRoutingOptions & Omit<osrm.RouteOptions, 'geometries'>;
