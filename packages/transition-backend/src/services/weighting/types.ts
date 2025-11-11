/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Full documentation on the weighting methodology is available in the docs/weighting directory. */

/**
 * Type of decay function to use
 */
export type DecayFunctionType = 'power' | 'exponential' | 'gamma' | 'combined' | 'logistic';

/**
 * Type of input value (distance or time)
 */
export type DecayInputValueType = 'distance' | 'time';

/**
 * Value object containing both distance and time values for decay function calculations.
 * The inputValueType parameter determines which value is used in the calculation.
 * One of the values can be undefined, but not both, and the value used in the calculation must be defined
 */
export type DecayInputValue =
    | { distanceMeters: number; travelTimeSeconds?: number }
    | { travelTimeSeconds: number; distanceMeters?: number };

/**
 * Minimum value for distance and time to prevent numerical instability in power-law decay functions.
 * Power functions like x^(-beta) approach infinity as x approaches zero.
 */
export const MIN_DISTANCE_METERS = 100; // 100 meters
export const MIN_TRAVEL_TIME_SECONDS = 60; // 60 seconds

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
