/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import GeoJSON from 'geojson';

import type { CsvFieldMappingDescriptor } from '../csv/types';

/** Full documentation on the weighting methodology is available in the docs/weighting directory. */

// ---------------------------------------------------------------------------
// CSV field mapping types (shared between frontend and backend)
// ---------------------------------------------------------------------------

/** Which points from the input file are used for weighting. */
export type WeightingInputType = 'poi' | 'odOrigins' | 'odDestinations' | 'odBoth';

/**
 * CSV column mapping for the weighting input file.
 * Which fields are present depends on the input type (POI vs OD).
 * Keys produced by `latLon`-type descriptors: `pointLat`/`pointLon`,
 * `originLat`/`originLon`, `destinationLat`/`destinationLon`.
 */
export type WeightingFileMapping = {
    projection?: string;
    pointLat?: string;
    pointLon?: string;
    originLat?: string;
    originLon?: string;
    destinationLat?: string;
    destinationLon?: string;
    weight?: string;
};

/**
 * Returns the {@link CsvFieldMappingDescriptor} array appropriate for
 * the given {@link WeightingInputType}. The `latLon` type produces
 * paired lat/lon dropdowns plus a projection selector in the shared
 * `FieldMappingsSelection` widget.
 */
const originLatLonAutoMatch = {
    autoMatchLat: ['o_lat', 'origin_lat', 'olat', 'originlat', 'lat_o', 'lat_origin'],
    autoMatchLon: ['o_lon', 'origin_lon', 'olon', 'originlon', 'lon_o', 'lon_origin', 'o_lng', 'origin_lng']
};

const destinationLatLonAutoMatch = {
    autoMatchLat: ['d_lat', 'destination_lat', 'dlat', 'destinationlat', 'dest_lat', 'lat_d', 'lat_dest'],
    autoMatchLon: [
        'd_lon',
        'destination_lon',
        'dlon',
        'destinationlon',
        'dest_lon',
        'lon_d',
        'lon_dest',
        'd_lng',
        'destination_lng',
        'dest_lng'
    ]
};

export function getWeightingFieldDescriptors(inputType: WeightingInputType): CsvFieldMappingDescriptor[] {
    const weight: CsvFieldMappingDescriptor = {
        key: 'weight',
        type: 'single',
        i18nLabel: 'transit:transitNode.accessibilityWeighting.poiFieldWeight',
        required: false,
        autoMatch: ['weight']
    };

    switch (inputType) {
    case 'poi':
        return [
            {
                key: 'point',
                type: 'latLon',
                i18nLabel: 'transit:transitNode.accessibilityWeighting.poiFieldPoint',
                required: true,
                autoMatchLat: ['lat', 'latitude', 'point_lat'],
                autoMatchLon: ['lon', 'lng', 'longitude', 'point_lon']
            },
            weight
        ];
    case 'odOrigins':
        return [
            {
                key: 'origin',
                type: 'latLon',
                i18nLabel: 'transit:transitNode.accessibilityWeighting.odFieldOrigin',
                required: true,
                ...originLatLonAutoMatch
            },
            weight
        ];
    case 'odDestinations':
        return [
            {
                key: 'destination',
                type: 'latLon',
                i18nLabel: 'transit:transitNode.accessibilityWeighting.odFieldDestination',
                required: true,
                ...destinationLatLonAutoMatch
            },
            weight
        ];
    case 'odBoth':
        return [
            {
                key: 'origin',
                type: 'latLon',
                i18nLabel: 'transit:transitNode.accessibilityWeighting.odFieldOrigin',
                required: true,
                ...originLatLonAutoMatch
            },
            {
                key: 'destination',
                type: 'latLon',
                i18nLabel: 'transit:transitNode.accessibilityWeighting.odFieldDestination',
                required: true,
                ...destinationLatLonAutoMatch
            },
            weight
        ];
    }
}

/** All decay function type values (for validation and choice lists). */
export const DECAY_TYPE_VALUES = ['power', 'exponential', 'gamma', 'combined', 'logistic'] as const;

/**
 * Type of decay function to use (shared for config and calculation).
 */
export type DecayFunctionType = 'power' | 'exponential' | 'gamma' | 'combined' | 'logistic';

/**
 * Type of input value (distance or time) for decay function calculations
 */
export type DecayInputValueType = 'distance' | 'time';

/**
 * Type of input value for place weight calculations
 * - birdDistance: Use bird distance (Euclidean distance) from PostGIS, no routing needed
 * - networkDistance: Use network distance from routing engine
 * - travelTime: Use travel time from routing engine
 */
export type WeightDecayInputType = 'birdDistance' | 'networkDistance' | 'travelTime';

/**
 * Routing mode for place weight calculations
 * TODO: Add more modes (cycling, driving) when supported in preferences and use cases.
 */
export type WeightingRoutingMode = 'walking';

/**
 * POI input type: GeoJSON Point feature with id as feature id and weight in properties
 * Used for place weight calculations
 */
export type POIInput = GeoJSON.Feature<GeoJSON.Point, { weight?: number }> & { id: number };

/**
 * Place weights dictionary: maps place IDs to their calculated weights
 * Format: { "id1": weight1, "id2": weight2, ... }
 * Note: Numeric POI IDs are converted to strings for object keys
 */
export type AccessibilityWeights = Record<string, number>;

/**
 * Value object containing both distance and time values for decay function calculations.
 * The inputValueType parameter determines which value is used in the calculation.
 * One of the values can be undefined, but not both, and the value used in the calculation must be defined
 */
export type DecayInputValue =
    | { distanceMeters: number; travelTimeSeconds?: number }
    | { travelTimeSeconds: number; distanceMeters?: number };

/** Minimum distance (meters) for numerical stability in power-law decay.
 * Power functions like x^(-beta) approach infinity as x approaches zero.
 */
export const MIN_DISTANCE_METERS = 100;

/** Minimum travel time (seconds) for numerical stability in power-law decay.
 * Power functions like x^(-beta) approach infinity as x approaches zero.
 */
export const MIN_TRAVEL_TIME_SECONDS = 60;

/**
 * Parameters for power decay function: f(x) = x^(-beta)
 *
 * Constraints:
 * - beta must be > 0 for decay behavior (typical range: 0.5 to 3.0)
 * - Larger beta values produce steeper decay curves
 * - Input x can be distance (meters) or time (seconds)
 */
export interface PowerDecayParameters {
    type: 'power';
    beta: number;
}

/**
 * Parameters for exponential decay function: f(x) = exp(-beta * x)
 *
 * Constraints:
 * - beta must be > 0 (beta = 0 would result in no decay, constant value of 1)
 * - Typical values range from 0.01 to 0.5 for moderate decay
 * - Larger beta values produce steeper exponential decay curves
 * - Input x can be distance (meters) or time (seconds)
 */
export interface ExponentialDecayParameters {
    type: 'exponential';
    beta: number;
}

/**
 * Parameters for gamma decay function: f(x) = a * x^(-b) * exp(-c * x)
 *
 * Constraints:
 * - a, b, and c must all be > 0 (all parameters must be positive)
 * - Recommended standard for four-step models (NCHRP 716)
 * - proposed values in NCHRP 716: a ≈ 5280, b ≈ 0.926, c ≈ 0.087 (careful, these were used with different units and will change the decay function curve if used with seconds and/or meters)
 * - Combines power-law and exponential decay behaviors
 * - Input x can be distance (meters) or time (seconds)
 */
export interface GammaDecayParameters {
    type: 'gamma';
    a: number;
    b: number;
    c: number;
}

/**
 * Parameters for combined decay function: f(x) = x^(-beta1) * exp(-beta2 * x)
 *
 * Constraints:
 * - beta1 must be > 0 for power-law component (typical range: 0.5 to 2.0)
 * - beta2 must be > 0 for exponential component (beta2 = 0 would result in pure power decay, which is not combined)
 * - Typical values: beta1 ≈ 0.5-2.0, beta2 ≈ 0.01-0.5
 * - Combines power-law and exponential decay behaviors
 * - Input x can be distance (meters) or time (seconds)
 */
export interface CombinedDecayParameters {
    type: 'combined';
    beta1: number;
    beta2: number;
}

/**
 * Parameters for logistic decay function: f(x) = 1 / (1 + exp(beta * (x - x0)))
 *
 * Constraints:
 * - beta must be > 0 (typical range: 0.1 to 1.0)
 * - x0 must be a finite number (inflection point where decay rate is maximum)
 * - Produces an S-shaped decay curve (sigmoid function)
 * - x0 represents the midpoint of the transition (in same units as input x)
 * - Larger beta values produce steeper transitions at x0
 * - Input x can be distance (meters) or time (seconds)
 */
export interface LogisticDecayParameters {
    type: 'logistic';
    beta: number;
    x0: number;
}

/**
 * Union type for all decay function parameters
 */
export type DecayFunctionParameters =
    | PowerDecayParameters
    | ExponentialDecayParameters
    | GammaDecayParameters
    | CombinedDecayParameters
    | LogisticDecayParameters;

/**
 * Keys of decay parameter objects that must be strictly positive per the
 * interfaces above. Excludes logistic {@link LogisticDecayParameters.x0}
 * (inflection point; zero or negative may be valid depending on units).
 */
export const DECAY_STRICTLY_POSITIVE_PARAMETER_KEYS = ['beta', 'a', 'b', 'c', 'beta1', 'beta2'] as const;

export type DecayStrictlyPositiveParameterKey = (typeof DECAY_STRICTLY_POSITIVE_PARAMETER_KEYS)[number];

/**
 * Lower bound used in UIs / client validation for strictly positive decay parameters.
 */
export const MIN_STRICTLY_POSITIVE_DECAY = 1e-6;
