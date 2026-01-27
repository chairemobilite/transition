/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import TrError from 'chaire-lib-common/lib/utils/TrError';
import { GeneralizedCostFunctionValues, GeneralizedCostFunctionWeights } from './types';

export class GeneralizedCostFunction {
    private weights: GeneralizedCostFunctionWeights;
    /**
     * Context in which the transit trip takes place, used to determine the headway high frequency thresholds in minutes
     * - 'urban': headway high frequency threshold is 10 minutes (TODO: there is no concensus though and would need more research/calibration)
     * - 'regional': headway high frequency threshold is 15 minutes (TODO: there is no concensus though and would need more research/calibration)
     * - 'intercity': headway high frequency threshold is 30 minutes (TODO: there is no concensus though and would need more research/calibration)
     *
     * @private
     * @type {('urban' | 'regional' | 'intercity')}
     */
    private context: 'urban' | 'regional' | 'intercity' = 'urban';

    constructor(weights: GeneralizedCostFunctionWeights, context: 'urban' | 'regional' | 'intercity') {
        this.weights = weights;
        this.context = context;
    }

    /**
     * Get the headway values for each leg
     * @param values GeneralizedCostFunctionValues object
     * @returns the headway values for each leg, undefined if no headway values are provided
     */
    getHeadways(values: GeneralizedCostFunctionValues): number[] | undefined {
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
     * Get the headway threshold in minutes based on the context.
     * Services with headway <= threshold are considered "high frequency".
     * @returns the headway threshold in minutes for the current context
     */
    getHeadwayThresholdSeconds(): number {
        if (this.context === 'urban') {
            return 10 * 60;
        } else if (this.context === 'regional') {
            return 15 * 60;
        } else if (this.context === 'intercity') {
            return 30 * 60;
        }
        return 10 * 60; // default (urban)
    }

    /**
     * Calculate the weighted travel time seconds
     * @param values GeneralizedCostFunctionValues object
     * @returns the weighted travel time seconds, in seconds
     */
    calculateWeightedTravelTimeSeconds(values: GeneralizedCostFunctionValues): number {
        if (values.byLeg.length === 0) {
            throw new TrError('At least one leg is required', 'GCO001', 'GeneralizedCostFunctionError');
        }

        const headwaysSeconds = this.getHeadways(values); // undefined if no headway values are provided
        const headwayThresholdSeconds = this.getHeadwayThresholdSeconds();

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
            weightedTravelTimeSeconds +=
                leg.inVehicleTravelTimeSeconds *
                (this.weights.inVehicleTravelTimeWeightByROW[leg.rightOfWayCategory] +
                    this.weights.inVehicleTravelTimeWeightBySupport[leg.support] +
                    this.weights.inVehicleTravelTimeWeightByVerticalAlignment[leg.verticalAlignment]);

            // We already calculated weighted waiting time at first stop
            if (i > 0) {
                // Calculate the weighted transfer waiting time seconds
                weightedTravelTimeSeconds +=
                    leg.waitingTimeSeconds *
                    this.weights.waitingTimeWeightByWeatherProtection[leg.weatherProtectionAtBoardingStop];

                // Calculate the weighted transfer travel time seconds
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

            // Calculate the weighted headway seconds if headway values are provided
            if (headwaysSeconds !== undefined) {
                const headwaySeconds = headwaysSeconds[i];

                // Determine if current leg has high or low frequency
                const frequencyCategory = headwaySeconds <= headwayThresholdSeconds ? 'high' : 'low';
                weightedTravelTimeSeconds += this.weights.boardingPenaltyByHeadwayThreshold[frequencyCategory];

                // Calculate the weighted headway seconds
                weightedTravelTimeSeconds += headwaySeconds * this.weights.headwayWeightByROW[leg.rightOfWayCategory];
            }
        }

        return weightedTravelTimeSeconds;
    }
}
