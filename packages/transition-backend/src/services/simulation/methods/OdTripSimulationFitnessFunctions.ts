/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';

/**
 * Represents the statistics from a simulation run
 */
export type SimulationStats = {
    transfersCount: number;
    totalCount: number;
    routedCount: number;
    nonRoutedCount: number;
    totalWalkingTimeMinutes: number;
    totalWaitingTimeMinutes: number;
    totalTravelTimeMinutes: number;
    avgWalkingTimeMinutes: number;
    avgWaitingTimeMinutes: number;
    avgTravelTimeMinutes: number;
    avgNumberOfTransfers: number;
    noTransferCount: number;
    operatingHourlyCost: number;
    usersHourlyCost: number;
    routableHourlyCost: number;
    nonRoutableHourlyCost: number;
    totalTravelTimeSecondsFromTrRouting: number;
    countByNumberOfTransfers: { [key: number]: number };
    sampleFileLinesCount: number;
    // Total weight of the sample, which can be different from the total count if the sample is weighted
    sampleTotalWeight: number;
};

/**
 * Type for fitness sorter functions
 */
export type FitnessSorter = (fitnessA: number, fitnessB: number) => number;

/**
 * Type for overall fitness functions (operating on simulation statistics)
 */
export type FitnessFunction = (stats: SimulationStats) => number;

/**
 * Type for OD trip fitness functions (operating on individual trips)
 */
export type OdTripFitnessFunction = (odTrip: TrRoutingRoute) => number;

export type NonRoutableTripFitnessFunction = (tripResults: RoutingResultsByMode) => number;

/**
 * Fitness sorters for genetic algorithms
 */
export const fitnessSorters: { [key: string]: FitnessSorter } = {
    maximize: function (fitnessA: number, fitnessB: number) {
        return fitnessB - fitnessA; // descendant (more chance to select candidates with high fitness)
    },
    minimize: function (fitnessA: number, fitnessB: number) {
        return fitnessA - fitnessB; // ascendent (more chance to select candidates with low fitness)
    }
};

/**
 * Fitness functions for routable OD trips
 */
const odTripFitnessFunctions: { [key: string]: OdTripFitnessFunction } = {
    travelTimeCost: function (odTrip: TrRoutingRoute) {
        const travelTime = odTrip.totalTravelTime || 0;
        const lostTime = odTrip.firstWaitingTime || 0;
        return (10 * travelTime) / 3600 + lostTime / 3600;
    },
    travelTimeWithTransferPenalty: function (odTrip: TrRoutingRoute) {
        const travelTime = odTrip.totalTravelTime || 0;
        const transfers = odTrip.numberOfTransfers || 0;
        const lostTime = odTrip.firstWaitingTime || 0;
        return (10 * (travelTime + transfers * 300)) / 3600 + lostTime / 3600;
    }
};

/**
 * Fitness functions for non-routable OD trips (fallback calculations)
 */
const nonRoutableOdTripFitnessFunctions: { [key: string]: NonRoutableTripFitnessFunction } = {
    taxi: function (odTrip: RoutingResultsByMode) {
        const drivingResults = odTrip['driving'];
        if (drivingResults && drivingResults.paths && drivingResults.paths.length > 0) {
            const drivingPath = drivingResults.paths[0];
            const travelTimeSeconds = drivingPath.duration || 0;
            return 3.5 + (87.5 * travelTimeSeconds) / 3600; // taxi at 50km/h
        }
        const walkingResults = odTrip['walking'];
        if (walkingResults && walkingResults.paths && walkingResults.paths.length > 0) {
            const walkingPath = walkingResults.paths[0];
            const travelTimeSeconds = walkingPath.duration || 0;
            // divide walking time by 10 to get an approximation of 50 km/h
            return 3.5 + (87.5 * travelTimeSeconds) / (10 * 3600); // taxi at 50km/h
        }
        // Fallback if no routing results at all
        return 30;
    }
};

/**
 * Overall fitness functions for evaluating simulation results
 */
const fitnessFunctions: { [key: string]: FitnessFunction } = {
    hourlyUserPlusOperatingCosts: function (stats: SimulationStats) {
        return stats.usersHourlyCost + stats.operatingHourlyCost;
    },
    hourlyUserCosts: function (stats: SimulationStats) {
        return stats.usersHourlyCost;
    },
    hourlyOperatingCosts: function (stats: SimulationStats) {
        return stats.operatingHourlyCost;
    }
};

/**
 * Get a fitness function by name
 */
export function getFitnessFunction(name: string): FitnessFunction {
    const fn = fitnessFunctions[name];
    if (!fn) {
        throw new Error(`Unknown fitness function: ${name}`);
    }
    return fn;
}

/**
 * Get an OD trip fitness function by name
 */
export function getOdTripFitnessFunction(name: string): OdTripFitnessFunction {
    const fn = odTripFitnessFunctions[name];
    if (!fn) {
        throw new Error(`Unknown OD trip fitness function: ${name}`);
    }
    return fn;
}

/**
 * Get a non-routable OD trip fitness function by name
 */
export function getNonRoutableOdTripFitnessFunction(name: string): NonRoutableTripFitnessFunction {
    const fn = nonRoutableOdTripFitnessFunctions[name];
    if (!fn) {
        throw new Error(`Unknown non-routable OD trip fitness function: ${name}`);
    }
    return fn;
}
