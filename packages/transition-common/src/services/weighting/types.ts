/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import GeoJSON from 'geojson';

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
 */
export type WeightingRoutingMode = 'walking';

/**
 * POI input type: GeoJSON Point feature with id as feature id and weight in properties
 */
export type POIInput = GeoJSON.Feature<GeoJSON.Point, { weight?: number }> & { id: number };

/**
 * Place weights dictionary: maps place IDs to their calculated weights
 */
export type AccessibilityWeights = Record<string, number>;

/**
 * Value object containing both distance and time values for decay function calculations.
 * The inputValueType parameter determines which value is used in the calculation.
 */
export type DecayInputValue =
    | { distanceMeters: number; travelTimeSeconds?: number }
    | { travelTimeSeconds: number; distanceMeters?: number };

/** Minimum distance (meters) for numerical stability in power-law decay. */
export const MIN_DISTANCE_METERS = 100;

/** Minimum travel time (seconds) for numerical stability in power-law decay. */
export const MIN_TRAVEL_TIME_SECONDS = 60;

/**
 * Parameters for power decay function: f(x) = x^(-beta)
 */
export interface PowerDecayParameters {
    type: 'power';
    beta: number;
}

/**
 * Parameters for exponential decay function: f(x) = exp(-beta * x)
 */
export interface ExponentialDecayParameters {
    type: 'exponential';
    beta: number;
}

/**
 * Parameters for gamma decay function: f(x) = a * x^(-b) * exp(-c * x)
 */
export interface GammaDecayParameters {
    type: 'gamma';
    a: number;
    b: number;
    c: number;
}

/**
 * Parameters for combined decay function: f(x) = x^(-beta1) * exp(-beta2 * x)
 */
export interface CombinedDecayParameters {
    type: 'combined';
    beta1: number;
    beta2: number;
}

/**
 * Parameters for logistic decay function: f(x) = 1 / (1 + exp(beta * (x - x0)))
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
