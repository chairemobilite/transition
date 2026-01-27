/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Modes for access/egress or transfer mode between transit legs:
 * walking: walking
 * cycling: cycling
 * driving: driving
 * TODO: add more like ebike, scooter, e-scooter, etc. or even maybe taxi?
 */
export const accessEgressTransferModes = ['walking', 'cycling', 'driving'] as const;

/** An enumeration of access/egress or transfer mode between transit legs */
export type AccessEgressTransferMode = (typeof accessEgressTransferModes)[number];

/** The array of modes that can be routed */
const nonAccessEgressTransferRoutingModes = [
    'walking_way_data_as_name',
    'driving_congestion',
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

/** An enumeration of modes that can be routed, excluding transit access/egress or transfer modes */
type NonAccessEgressTransferRoutingMode = (typeof nonAccessEgressTransferRoutingModes)[number];

export const routingModes = [...nonAccessEgressTransferRoutingModes, ...accessEgressTransferModes] as const;

/** An enumeration of modes that can be routed */
export type RoutingMode = NonAccessEgressTransferRoutingMode | AccessEgressTransferMode;

/** A type for the transit mode */
export type TransitMode = 'transit';

/** An enumeration of all possible routing modes, including transit */
export type RoutingOrTransitMode = RoutingMode | TransitMode;
