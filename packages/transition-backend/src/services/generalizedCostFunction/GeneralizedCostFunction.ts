/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TrError from 'chaire-lib-common/lib/utils/TrError';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { GeneralizedCostFunctionValues, GeneralizedCostFunctionWeights } from './types';
export class GeneralizedCostFunction {
    private weights: GeneralizedCostFunctionWeights;

    constructor(weights: GeneralizedCostFunctionWeights) {
        this.weights = weights;
    }

    /**
     * Validate that a time value is finite and non-negative.
     * @param value The time value to validate
     * @returns true if valid (finite and >= 0), false otherwise
     */
    private isValidTimeValue(value: number): boolean {
        return Number.isFinite(value) && value >= 0;
    }

    /**
     * Get the headway values for each leg
     * @param values GeneralizedCostFunctionValues object
     * @returns the headway values for each leg, undefined if any headway value is missing
     * or invalid (undefined/NaN/not finite/negative)
     */
    private getHeadways(values: GeneralizedCostFunctionValues): number[] | undefined {
        if (!values.byLeg || values.byLeg.length === 0) {
            return undefined;
        }
        const headwayByLegIndex: number[] = [];
        for (const legIndex in values.byLeg) {
            const leg = values.byLeg[legIndex];
            if (leg.headwaySeconds === undefined || !this.isValidTimeValue(leg.headwaySeconds)) {
                return undefined;
            }
            headwayByLegIndex.push(leg.headwaySeconds);
        }
        return headwayByLegIndex;
    }

    /**
     * Calculate the weighted travel time seconds
     * @param values GeneralizedCostFunctionValues object
     * @returns Status with the weighted travel time seconds, or error if validation fails
     */
    public calculateWeightedTravelTimeSeconds(values: GeneralizedCostFunctionValues): Status.Status<number> {
        if (values.byLeg.length === 0) {
            return Status.createError(
                new TrError('At least one leg is required', 'GCO001', 'GeneralizedCostFunctionError')
            );
        }

        // Validate access and egress travel times
        if (!this.isValidTimeValue(values.accessTravelTimeSeconds)) {
            return Status.createError(
                new TrError(
                    'Invalid accessTravelTimeSeconds: must be finite and >= 0',
                    'GCO002',
                    'GeneralizedCostFunctionError'
                )
            );
        }
        if (!this.isValidTimeValue(values.egressTravelTimeSeconds)) {
            return Status.createError(
                new TrError(
                    'Invalid egressTravelTimeSeconds: must be finite and >= 0',
                    'GCO003',
                    'GeneralizedCostFunctionError'
                )
            );
        }

        // Validate first leg waiting time
        if (!this.isValidTimeValue(values.byLeg[0].waitingTimeSeconds)) {
            return Status.createError(
                new TrError(
                    'Invalid waitingTimeSeconds for leg 0: must be finite and >= 0',
                    'GCO004',
                    'GeneralizedCostFunctionError'
                )
            );
        }

        // Validate all leg time values upfront
        for (let i = 0; i < values.byLeg.length; i++) {
            const leg = values.byLeg[i];
            if (!this.isValidTimeValue(leg.inVehicleTravelTimeSeconds)) {
                return Status.createError(
                    new TrError(
                        `Invalid inVehicleTravelTimeSeconds for leg ${i}: must be finite and >= 0`,
                        'GCO005',
                        'GeneralizedCostFunctionError'
                    )
                );
            }
            if (i > 0) {
                if (!this.isValidTimeValue(leg.waitingTimeSeconds)) {
                    return Status.createError(
                        new TrError(
                            `Invalid waitingTimeSeconds for leg ${i}: must be finite and >= 0`,
                            'GCO006',
                            'GeneralizedCostFunctionError'
                        )
                    );
                }
                if (!this.isValidTimeValue(leg.transferTravelTimeSeconds)) {
                    return Status.createError(
                        new TrError(
                            `Invalid transferTravelTimeSeconds for leg ${i}: must be finite and >= 0`,
                            'GCO007',
                            'GeneralizedCostFunctionError'
                        )
                    );
                }
            }
        }

        const headwaysSeconds = this.getHeadways(values); // undefined if no headway values are provided

        // Initialize the weighted travel time seconds
        let weightedTravelTimeSeconds = 0;

        // Calculate the weighted access/egress travel time seconds
        weightedTravelTimeSeconds +=
            this.weights.accessTravelTimeWeightByMode[values.accessMode] * values.accessTravelTimeSeconds +
            this.weights.egressTravelTimeWeightByMode[values.egressMode] * values.egressTravelTimeSeconds;

        // Calculate the weighted waiting time seconds at the first boarding stop
        weightedTravelTimeSeconds +=
            this.weights.firstWaitingTimeWeightByWeatherProtection[values.byLeg[0].weatherProtectionAtBoardingStop] *
            values.byLeg[0].waitingTimeSeconds;

        // Calculate the weighted travel time seconds for each leg
        for (let i = 0; i < values.byLeg.length; i++) {
            const leg = values.byLeg[i];

            /**
             * Calculate the weighted in-vehicle travel time seconds.
             * Weights for ROW, support, vertical alignment and load factor
             * are multiplied before applying to inVehicleTravelTimeSeconds.
             *
             * Like other in-vehicle weights, the load factor weight can be:
             * - < 1: model productive time (e.g., working on an empty train)
             * - = 1: neutral
             * - > 1: strong crowding aversion
             *
             * The formula weight * (loadFactor + 1) allows this flexibility.
             */
            weightedTravelTimeSeconds +=
                leg.inVehicleTravelTimeSeconds *
                (this.weights.inVehicleTravelTimeWeightByROW[leg.rightOfWayCategory] *
                    this.weights.inVehicleTravelTimeWeightBySupport[leg.support] *
                    this.weights.inVehicleTravelTimeWeightByVerticalAlignment[leg.verticalAlignment] *
                    /**
                     * Load factor: weight * (loadFactor + 1.0).
                     * With weight = 1.0: empty (0) = no effect, crowded (1) = doubles time.
                     * Weight < 1 can model productive travel time.
                     * Ignored if undefined, not finite, or negative (defaults to 1.0).
                     */
                    (leg.loadFactor !== undefined && Number.isFinite(leg.loadFactor) && leg.loadFactor >= 0
                        ? this.weights.inVehicleTravelTimeWeightForLoadFactor * (leg.loadFactor + 1.0)
                        : 1.0));

            // We already calculated weighted waiting time at first stop
            if (i > 0) {
                // Calculate the weighted transfer waiting time seconds
                weightedTravelTimeSeconds +=
                    leg.waitingTimeSeconds *
                    this.weights.waitingTimeWeightByWeatherProtection[leg.weatherProtectionAtBoardingStop];

                /**
                 * Calculate the weighted transfer travel time seconds.
                 * TODO: implement an increasing transfer travel time weight
                 * by transfer index, if the modeling says we need to do so.
                 */
                weightedTravelTimeSeconds +=
                    leg.transferTravelTimeSeconds * this.weights.transferTravelTimeWeightByMode[values.accessMode];

                // Calculate the weighted transfer penalty seconds by index
                const transferIndex = i - 1;
                if (this.weights.transferPenaltySecondsByIndex[transferIndex] !== undefined) {
                    weightedTravelTimeSeconds += this.weights.transferPenaltySecondsByIndex[transferIndex];
                } else {
                    weightedTravelTimeSeconds += this.weights.transferPenaltySecondsMax;
                }
            }

            /**
             * Calculate the penalty for headway.
             * The penalty added is in seconds, like the rest, and is
             * calculated like this: weight * headway in seconds = penalty in seconds.
             */
            if (headwaysSeconds !== undefined) {
                const headwaySeconds = headwaysSeconds[i];
                weightedTravelTimeSeconds +=
                    headwaySeconds * this.weights.headwayPenaltyWeightByROW[leg.rightOfWayCategory];
            }

            /**
             * Calculate the penalty for unreliability.
             * Uses (1 - reliabilityRatio) so higher reliability = lower penalty.
             * 100% reliable (1.0) → 0 penalty, 0% reliable (0.0) → full penalty.
             * Only applies if reliabilityRatio is in valid range [0, 1].
             */
            if (
                leg.reliabilityRatio !== undefined &&
                Number.isFinite(leg.reliabilityRatio) &&
                leg.reliabilityRatio >= 0 &&
                leg.reliabilityRatio <= 1
            ) {
                weightedTravelTimeSeconds += this.weights.reliabilityRatioPenaltyWeight * (1 - leg.reliabilityRatio);
            }
        }

        return Status.createOk(weightedTravelTimeSeconds);
    }
}
