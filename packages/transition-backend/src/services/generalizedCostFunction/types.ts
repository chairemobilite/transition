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
 * TODO: implement crowding weights but this will be difficult without having to import demand data.
 * TODO: implement reliability weights but this will be difficult without having to import reliability data.
 * TODO: implement a real cost (money) function with values of time and fares
 */
export type GeneralizedCostFunctionValues = {
    accessMode: AccessEgressTransferMode;
    egressMode: AccessEgressTransferMode;
    accessTravelTimeSeconds: number; // t_e_O: non-transit travel time to access the first boarding stop
    egressTravelTimeSeconds: number; // t_e_D: non-transit travel time to egress from the last alighting stop

    // i: index of each transit leg of the transit route, starts at 0 for first transit leg
    byLeg: {
        // TODO: implement Stop so we can get the weather protection data.
        // A node includes may include many stops and thus could not have a unique weather protection.
        weatherProtectionAtBoardingStop: WeatherProtection; // weather protection of the stop
        inVehicleTravelTimeSeconds: number; // t_veh: travel time in transit vehicle/unit, in seconds
        transferTravelTimeSeconds: number; // t_tr: non-transit travel time between transfer stops, in seconds
        waitingTimeSeconds: number; // t_w_tr: waiting time at transfer boarding stop, in seconds
        headwaySeconds?: number; // h: headway of the line path, in seconds
        rightOfWayCategory: RightOfWayCategory; // ROW: Right-of-way category of the line
        verticalAlignment: VerticalAlignment; // vertical alignment of the line // TODO: implement by path/segment
        support: Support; // support of the line
        loadFactor: LoadFactor; // comfort coefficient of the line (number >= 0.0)
        reliabilityRatio: ReliabilityRatio; // reliability ratio of the line/path (ratio of on-time arrivals/departures compared to planned schedules. On-time = between 0 and 3 minutes late. Value is between 0.0 and 1.0 (100%))
    }[];
};

/**
 * Weights used in the generalized cost function
 * Usually, the inVehicleTravelTimeSeconds weight has a value of 1, while other times weights have values < or > 1.
 */
export type GeneralizedCostFunctionWeights = {
    // Access/egress and transfer travel times weights:
    accessTravelTimeWeightByMode: {
        // w_t_e_O: weight for the accessTravelTimeSeconds
        [mode in AccessEgressTransferMode]: number;
    };
    egressTravelTimeWeightByMode: {
        // w_t_e_D: weight for the egressTravelTimeSeconds
        [mode in AccessEgressTransferMode]: number;
    };
    transferTravelTimeWeightByMode: {
        [mode in AccessEgressTransferMode]: number;
    };

    // In-vehicle travel time weights (w_t_veh):
    // For ROW, support, vertical alignment and weather protection, the weight for the unknown value must always be set.
    // for the unknown values of these three, the weights would usually be 1.0.
    // If more than one of these are used together, we should multiply each of the weights before appliying them to the inVehicleTravelTimeSeconds.
    inVehicleTravelTimeWeightByROW: Record<RightOfWayCategory, number>; // weight for the inVehicleTravelTimeSeconds by ROW category
    inVehicleTravelTimeWeightBySupport: Record<Support, number>; // weight for the inVehicleTravelTimeSeconds by support (rail, tires, water, suspended, magnetic, air, hover, hydrostatic)
    inVehicleTravelTimeWeightByVerticalAlignment: Record<VerticalAlignment, number>;
    inVehicleTravelTimeWeightForLoadFactor: number; // weight for the inVehicleTravelTimeSeconds multiplied by the comfort coefficient. We need to add 1.0 to the provided coefficient so the value is >= 1.0

    // Waiting time weights (w_t_w):
    // If we don't want or can't take into account the weather protection at the boarding stop, we can set the weight to 0.0 except for the unknown value.
    // first boarding stop (leg index 0):
    firstWaitingTimeWeightByWeatherProtection: Record<WeatherProtection, number>; // w_t_w_O: weight for the firstWaitingTimeSeconds
    // and for leg index > 0:
    waitingTimeWeightByWeatherProtection: Record<WeatherProtection, number>; // weight for the waitingTimeSeconds by weather protection

    // Transfer penalties:
    //
    transferPenaltyByIndex: number[]; // penalty for the transfer (index i, starts at 0 for first transfer), in seconds
    transferPenaltyMax: number; // maximum penalty for index > provided. For instance, if penalty is given for transfer index 0, 1, 2 only (transfer 1, 2 and 3 respectively), then transferPenaltyMax is the penalty for transfer index 3+ (transfer 4+).
    boardingPenaltyByHeadwayThreshold: {
        high: number; // penalty for a transfer with headway at boarding stop <= headwayThreshold
        low: number; // penalty for a transfer with headway at boarding stop > headwayThreshold
    };

    // Headway weights:
    // The headway penalty weight: we multiply the penalty weight by the headway in seconds
    headwayPenaltyWeightByROW: Record<RightOfWayCategory, number>; // penalty weight for the headway by ROW category (headway in seconds)

    // Reliability weights:
    reliabilityRatioPenaltyWeight: number; // penalty weight for the reliability ratio (ratio of on-time arrivals/departures compared to planned schedules. On-time = between 0 and 3 minutes late. Value is between 0.0 and 1.0 (100%))
};
