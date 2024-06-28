/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/** The array of modes that can be routed */
export const routingModes = [
    'walking',
    'walking_way_data_as_name',
    'driving',
    'driving_congestion',
    'cycling',
    'bus_urban',
    'bus_suburb',
    'bus_congestion',
    'rail',
    'tram',
    'tram_train',
    'metro',
    'monorail',
    'cable_car'
] as const;

/** An enumeration of modes that can be routed */
export type RoutingMode = (typeof routingModes)[number];

/** A type for the transit mode */
export type TransitMode = 'transit';

/** An enumeration of all possible routing modes, including transit */
export type RoutingOrTransitMode = RoutingMode | TransitMode;
