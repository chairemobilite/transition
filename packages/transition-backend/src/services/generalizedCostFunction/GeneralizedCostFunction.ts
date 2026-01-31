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
     * Get the headway values for each leg
     * @param values GeneralizedCostFunctionValues object
     * @returns the headway values for each leg, undefined if no headway values are provided
     */
    private getHeadways(values: GeneralizedCostFunctionValues): number[] | undefined {
        if (!values.byLeg || values.byLeg.length === 0) {
            return undefined;
        }
        const headwayByLegIndex: number[] = [];
        for (const legIndex in values.byLeg) {
            const leg = values.byLeg[legIndex];
            if (leg.headwaySeconds === undefined) {
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

            // Calculate the weighted in-vehicle travel time seconds
            // We multiply the weights for ROW, support, vertical alignment and weighted comfort coefficient before appliying them to the inVehicleTravelTimeSeconds.
            weightedTravelTimeSeconds +=
                leg.inVehicleTravelTimeSeconds *
                (this.weights.inVehicleTravelTimeWeightByROW[leg.rightOfWayCategory] *
                    this.weights.inVehicleTravelTimeWeightBySupport[leg.support] *
                    this.weights.inVehicleTravelTimeWeightByVerticalAlignment[leg.verticalAlignment] *
                    // We need to add 1.0 to the provided coefficient so the weighted time is >= 1.0. Ignore if undefined or NaN (set to 1.0 so it has no effect)
                    (leg.loadFactor !== undefined && !isNaN(leg.loadFactor)
                        ? this.weights.inVehicleTravelTimeWeightForLoadFactor * (leg.loadFactor + 1.0)
                        : 1.0));

            // We already calculated weighted waiting time at first stop
            if (i > 0) {
                // Calculate the weighted transfer waiting time seconds
                weightedTravelTimeSeconds +=
                    leg.waitingTimeSeconds *
                    this.weights.waitingTimeWeightByWeatherProtection[leg.weatherProtectionAtBoardingStop];

                // Calculate the weighted transfer travel time seconds
                // TODO: implement an increasing transfer travel time weight by transfer index, if the modeling says we need to do so.
                weightedTravelTimeSeconds +=
                    leg.transferTravelTimeSeconds * this.weights.transferTravelTimeWeightByMode[values.accessMode];

                // Calculate the weighted transfer penalty seconds by index
                const transferIndex = i - 1;
                if (this.weights.transferPenaltyByIndex[transferIndex] !== undefined) {
                    weightedTravelTimeSeconds += this.weights.transferPenaltyByIndex[transferIndex];
                } else {
                    weightedTravelTimeSeconds += this.weights.transferPenaltyMax;
                }
            }

            // Calculate the penalty for headway:
            if (headwaysSeconds !== undefined) {
                const headwaySeconds = headwaysSeconds[i];
                weightedTravelTimeSeconds +=
                    headwaySeconds * this.weights.headwayPenaltyWeightByROW[leg.rightOfWayCategory];
            }

            // Calculate the penalty for reliability ratio:
            if (leg.reliabilityRatio !== undefined && !isNaN(leg.reliabilityRatio)) {
                weightedTravelTimeSeconds += this.weights.reliabilityRatioPenaltyWeight * leg.reliabilityRatio;
            }
        }

        return Status.createOk(weightedTravelTimeSeconds);
    }
}
