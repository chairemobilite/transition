/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type {
    RightOfWayCategory,
    Support,
    VerticalAlignment,
    LoadFactor,
    ReliabilityRatio
} from 'transition-common/lib/services/line/types';
import type { AccessEgressTransferMode } from 'chaire-lib-common/lib/config/routingModes';
import type { WeatherProtection } from 'transition-common/lib/services/nodes/types';

/** Variables used in the generalized cost function
 * Symbols and definitions are available at https://www.overleaf.com/read/dtxfhttxgjrx
 * Reliability weights are implemented via `ReliabilityRatio` (per-leg value)
 * and `reliabilityRatioPenaltyWeight` (weight).
 * TODO: implement a real cost (money) function with values of time and fares
 */
export type GeneralizedCostFunctionValues = {
    accessMode: AccessEgressTransferMode;
    egressMode: AccessEgressTransferMode;
    /** t_e_O: non-transit travel time to access the first boarding stop */
    accessTravelTimeSeconds: number;
    /** t_e_D: non-transit travel time to egress from the last alighting stop */
    egressTravelTimeSeconds: number;

    /**
     * Array of transit legs in the route.
     * Index starts at 0 for first transit leg.
     */
    byLeg: {
        /**
         * Weather protection at the boarding stop.
         * TODO: implement Stop so we can get the weather protection data.
         * A node may include many stops and thus could not have unique protection.
         */
        weatherProtectionAtBoardingStop: WeatherProtection;
        /** t_veh: travel time in transit vehicle/unit, in seconds */
        inVehicleTravelTimeSeconds: number;
        /** t_tr: non-transit travel time between transfer stops, in seconds */
        transferTravelTimeSeconds: number;
        /** t_w_tr: waiting time at transfer boarding stop, in seconds */
        waitingTimeSeconds: number;
        /** h: headway of the line path, in seconds */
        headwaySeconds?: number;
        /** ROW: Right-of-way category of the line */
        rightOfWayCategory: RightOfWayCategory;
        /**
         * Vertical alignment of the line.
         * TODO: implement by path/segment
         */
        verticalAlignment: VerticalAlignment;
        /** Support of the line (rail, tires, water, etc.) */
        support: Support;
        /** Comfort coefficient of the line (number >= 0.0) */
        loadFactor: LoadFactor;
        /**
         * Reliability ratio of the line/path.
         * Ratio of on-time arrivals/departures vs planned schedules.
         * On-time = between 0 and 3 minutes late.
         * Value must be between 0.0 and 1.0 (100%).
         * Values outside this range are ignored.
         */
        reliabilityRatio: ReliabilityRatio;
    }[];
};

/**
 * Weights used in the generalized cost function.
 *
 * **All weights must be >= 0**:
 * - Weight in (0, 1): reduces perceived time (e.g., productive travel)
 * - Weight = 1: neutral (no adjustment)
 * - Weight > 1: increases perceived time (penalty)
 *
 * Penalties (for transfers and headway) must also be >= 0.
 */
export type GeneralizedCostFunctionWeights = {
    /** w_t_e_O: weight for the accessTravelTimeSeconds by mode */
    accessTravelTimeWeightByMode: {
        [mode in AccessEgressTransferMode]: number;
    };
    /** w_t_e_D: weight for the egressTravelTimeSeconds by mode */
    egressTravelTimeWeightByMode: {
        [mode in AccessEgressTransferMode]: number;
    };
    /** Weight for the transferTravelTimeSeconds by mode */
    transferTravelTimeWeightByMode: {
        [mode in AccessEgressTransferMode]: number;
    };

    /**
     * In-vehicle travel time weights (w_t_veh).
     * For ROW, support, vertical alignment and weather protection,
     * the weight for the 'unknown' value must always be set (usually 1.0).
     * If more than one of these are used together, multiply each weight
     * before applying them to inVehicleTravelTimeSeconds.
     */
    /** Weight for inVehicleTravelTimeSeconds by ROW category */
    inVehicleTravelTimeWeightByROW: Record<RightOfWayCategory, number>;
    /**
     * Weight for inVehicleTravelTimeSeconds by support type
     * (rail, tires, water, suspended, magnetic, air, hover, hydrostatic)
     */
    inVehicleTravelTimeWeightBySupport: Record<Support, number>;
    /** Weight for inVehicleTravelTimeSeconds by vertical alignment */
    inVehicleTravelTimeWeightByVerticalAlignment: Record<VerticalAlignment, number>;
    /**
     * Weight for load factor: multiplier = weight * (loadFactor + 1).
     * With weight = 1.0: empty vehicle has no effect, crowded doubles time.
     * Weight < 1 can model productive travel (e.g., working on train).
     */
    inVehicleTravelTimeWeightForLoadFactor: number;

    /**
     * Waiting time weights (w_t_w).
     * If you don't want/can't account for weather protection at boarding stop,
     * set all weights to 1.0 except use the 'unknown' value as the single weight.
     */
    /**
     * w_t_w_O: weight for firstWaitingTimeSeconds (leg index 0)
     * by weather protection at boarding stop
     */
    firstWaitingTimeWeightByWeatherProtection: Record<WeatherProtection, number>;
    /**
     * Weight for waitingTimeSeconds (leg index > 0)
     * by weather protection at boarding stop
     */
    waitingTimeWeightByWeatherProtection: Record<WeatherProtection, number>;

    /**
     * Penalty for each transfer (index starts at 0), in seconds.
     * E.g., transferPenaltyByIndex[0] = penalty for first transfer.
     * Penalty is in seconds
     * Summed as is, no multiplier/weight applied
     * Must be >= 0.
     */
    transferPenaltySecondsByIndex: number[];
    /**
     * Maximum penalty for transfer index > provided array length.
     * E.g., if penalties given for index 0, 1, 2 only,
     * transferPenaltyMax applies to transfer index 3+.
     * Penalty is in seconds
     * Summed as is, no multiplier/weight applied
     * Must be >= 0.
     */
    transferPenaltySecondsMax: number;

    /**
     * Headway penalty weight by ROW category.
     * Multiplied by headway in seconds.
     * Must be >= 0.
     */
    headwayPenaltyWeightByROW: Record<RightOfWayCategory, number>;

    /**
     * Penalty weight for unreliability: weight * (1 - reliabilityRatio).
     * 100% reliable (1.0) → 0 penalty, 0% reliable (0.0) → full penalty.
     * The weight represents max penalty (in seconds) for completely unreliable service.
     */
    reliabilityRatioPenaltyWeight: number;
};
