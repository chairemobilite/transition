/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TrError from 'chaire-lib-common/lib/utils/TrError';
import {
    DecayFunctionParameters,
    PowerDecayParameters,
    ExponentialDecayParameters,
    GammaDecayParameters,
    CombinedDecayParameters,
    LogisticDecayParameters,
    DecayInputValueType,
    DecayInputValue,
    MIN_DISTANCE_METERS,
    MIN_TRAVEL_TIME_SECONDS
} from './types';

/**
 * Calculator for distance and time decay functions used in gravity-based
 * accessibility and weighting models.
 *
 * Implements the decay functions described in the weighting documentation:
 * - Power: f(x) = x^(-beta)
 * - Exponential: f(x) = exp(-beta * x)
 * - Gamma: f(x) = a * x^(-b) * exp(-c * x) [NCHRP 716 recommended]
 * - Combined: f(x) = x^(-beta1) * exp(-beta2 * x)
 * - Logistic: f(x) = 1 / (1 + exp(beta * (x - x0)))
 *
 * Where x can be either distance (in meters) or time (in seconds).
 */
export class DecayFunctionCalculator {
    /**
     * Get the input value (distance or time) from the DecayInputValue object based on inputValueType
     *
     * @param inputValue Value object containing both distance and time
     * @param inputValueType Type of the input value (distance or time)
     * @returns The distance or time value based on inputValueType
     */
    private static getInputValue(inputValue: DecayInputValue, inputValueType: DecayInputValueType): number {
        if (inputValueType === 'distance') {
            if (inputValue.distanceMeters === undefined) {
                throw new TrError('Distance value is required but was undefined', 'WDF001', 'WeightingError');
            }
            return inputValue.distanceMeters;
        } else if (inputValueType === 'time') {
            if (inputValue.travelTimeSeconds === undefined) {
                throw new TrError('Time value is required but was undefined', 'WDF002', 'WeightingError');
            }
            return inputValue.travelTimeSeconds;
        } else {
            throw new TrError(
                `Unsupported inputValueType '${inputValueType}' in DecayFunctionCalculator.getInputValue. Expected 'distance' or 'time'.`,
                'WDF003',
                'WeightingError'
            );
        }
    }

    /**
     * Get the adjusted input value with thresholds applied
     * For now, we only apply thresholds to get the minimum value for the input value,
     * replacing very small and 0 values to a minimum constant to avoid near infinity
     * values or division by 0 or undefined. In the future, we may want to apply
     * other thresholds or other functions to handle the input values.
     *
     * @param inputValue Value object containing both distance and time
     * @param inputValueType Type of the input value (distance or time)
     * @returns The input value adjusted to meet minimum thresholds (MIN_DISTANCE_METERS for distance, MIN_TRAVEL_TIME_SECONDS for time)
     */
    private static getAdjustedValue(inputValue: DecayInputValue, inputValueType: DecayInputValueType): number {
        const adjustedInputValue = this.getInputValue(inputValue, inputValueType);
        if (adjustedInputValue < MIN_DISTANCE_METERS && inputValueType === 'distance') {
            return MIN_DISTANCE_METERS;
        } else if (adjustedInputValue < MIN_TRAVEL_TIME_SECONDS && inputValueType === 'time') {
            return MIN_TRAVEL_TIME_SECONDS;
        }
        return adjustedInputValue;
    }

    /**
     * Calculate decay function value (generic, works for both distance and time)
     *
     * @param inputValue Value object containing both distance and time
     * @param inputValueType Type of the input value (distance or time) - determines which value from inputValue is used
     * @param parameters Decay function parameters
     * @returns Decay function value (friction factor)
     * @throws TrError if parameters are invalid
     */
    static calculateDecay(
        inputValue: DecayInputValue,
        inputValueType: DecayInputValueType,
        parameters: DecayFunctionParameters
    ): number {
        this.validateParameters(inputValue, inputValueType, parameters);

        /**
         * Handle very small input value for decay functions
         * Some functions are undefined at zero or would return numbers
         * near infinity for very small numbers, so we return appropriate limits.
         * Since most of these formulas were created and tested with zonal data,
         * distances or travel times of 0 or very small values between two zones
         * are indeed not possible.
         * So we need to put a minimum threshold in the input values for some functions
         * that would be undefined dividing by 0 or return numbers near infinity.
         * For travel time, we will use a minimum of 60 seconds.
         * For distance, we will use a minimum of 100 meters.
         * This is a compromise between the accuracy of the model and the practicality of the data.
         * However, using the exponential decay function, the result would be close to 1 for very small values,
         * so this would be the best function to use if very small values are expected.
         */
        const adjustedX = this.getAdjustedValue(inputValue, inputValueType);

        switch (parameters.type) {
        case 'power':
            return this.calculatePowerDecay(adjustedX, parameters);
        case 'exponential':
            return this.calculateExponentialDecay(adjustedX, parameters);
        case 'gamma':
            return this.calculateGammaDecay(adjustedX, parameters);
        case 'combined':
            return this.calculateCombinedDecay(adjustedX, parameters);
        case 'logistic':
            return this.calculateLogisticDecay(adjustedX, parameters);
        default: {
            const exhaustiveCheck: never = parameters;
            throw new TrError(
                `Unknown decay function type: ${(exhaustiveCheck as DecayFunctionParameters).type}`,
                'WDF004',
                'WeightingError'
            );
        }
        }
    }

    /**
     * Calculate power decay: f(x) = x^(-beta)
     */
    private static calculatePowerDecay(x: number, params: PowerDecayParameters): number {
        return Math.pow(x, -params.beta);
    }

    /**
     * Calculate exponential decay: f(x) = exp(-beta * x)
     */
    private static calculateExponentialDecay(x: number, params: ExponentialDecayParameters): number {
        return Math.exp(-params.beta * x);
    }

    /**
     * Calculate gamma decay: f(x) = a * x^(-b) * exp(-c * x)
     * Recommended standard for four-step models (NCHRP 716)
     */
    private static calculateGammaDecay(x: number, params: GammaDecayParameters): number {
        return params.a * Math.pow(x, -params.b) * Math.exp(-params.c * x);
    }

    /**
     * Calculate combined decay: f(x) = x^(-beta1) * exp(-beta2 * x)
     * Combines power-law and exponential decays
     */
    private static calculateCombinedDecay(x: number, params: CombinedDecayParameters): number {
        return Math.pow(x, -params.beta1) * Math.exp(-params.beta2 * x);
    }

    /**
     * Calculate logistic decay: f(x) = 1 / (1 + exp(beta * (x - x0)))
     * S-shaped decay curve
     */
    private static calculateLogisticDecay(x: number, params: LogisticDecayParameters): number {
        return 1 / (1 + Math.exp(params.beta * (x - params.x0)));
    }

    /**
     * Validate decay function parameters and input values
     *
     * @param inputValue Value object containing both distance and time
     * @param inputValueType Type of the input value (distance or time) - determines which value from inputValue is validated
     * @param parameters Decay function parameters to validate
     * @returns true if valid, throws TrError if invalid
     * @throws TrError if parameters or input values are invalid
     */
    static validateParameters(
        inputValue: DecayInputValue,
        inputValueType: DecayInputValueType,
        parameters: DecayFunctionParameters
    ): boolean {
        if (inputValueType !== 'distance' && inputValueType !== 'time') {
            throw new TrError('Input value type must be either "distance" or "time"', 'WDF005', 'WeightingError');
        }

        const x = this.getInputValue(inputValue, inputValueType);

        if (!Number.isFinite(x) || x < 0) {
            throw new TrError('Input value must be a finite non-negative number', 'WDF006', 'WeightingError');
        }

        switch (parameters.type) {
        case 'power':
            if (!Number.isFinite(parameters.beta) || parameters.beta <= 0) {
                throw new TrError(
                    'Power decay parameter beta must be a positive finite number',
                    'WDF007',
                    'WeightingError'
                );
            }
            break;
        case 'exponential':
            if (!Number.isFinite(parameters.beta) || parameters.beta <= 0) {
                throw new TrError(
                    'Exponential decay parameter beta must be a positive finite number',
                    'WDF008',
                    'WeightingError'
                );
            }
            break;
        case 'gamma':
            if (
                !Number.isFinite(parameters.a) ||
                    parameters.a <= 0 ||
                    !Number.isFinite(parameters.b) ||
                    parameters.b <= 0 ||
                    !Number.isFinite(parameters.c) ||
                    parameters.c <= 0
            ) {
                throw new TrError(
                    'Gamma decay parameters a, b, and c must all be positive finite numbers',
                    'WDF009',
                    'WeightingError'
                );
            }
            break;
        case 'combined':
            if (
                !Number.isFinite(parameters.beta1) ||
                    parameters.beta1 <= 0 ||
                    !Number.isFinite(parameters.beta2) ||
                    parameters.beta2 <= 0
            ) {
                throw new TrError(
                    'Combined decay parameters beta1 and beta2 must be positive finite numbers',
                    'WDF010',
                    'WeightingError'
                );
            }
            break;
        case 'logistic':
            if (!Number.isFinite(parameters.beta) || parameters.beta <= 0 || !Number.isFinite(parameters.x0)) {
                throw new TrError(
                    'Logistic decay parameter beta must be positive and x0 must be a finite number',
                    'WDF011',
                    'WeightingError'
                );
            }
            break;
        default: {
            const exhaustiveCheck: never = parameters;
            throw new TrError(
                `Unknown decay function type: ${(exhaustiveCheck as DecayFunctionParameters).type}`,
                'WDF012',
                'WeightingError'
            );
        }
        }
        return true;
    }
}
