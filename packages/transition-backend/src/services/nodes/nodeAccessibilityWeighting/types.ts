/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import GeoJSON from 'geojson';
import type { DecayFunctionParameters } from 'transition-common/lib/services/weighting/types';
import type {
    TableManyToManyParameters,
    TableManyToManyResults
} from 'chaire-lib-common/lib/services/routing/RoutingService';

/** Default walking speed in m/s (~5 km/h), used for bird-distance pre-filter radius. */
export const DEFAULT_WALKING_SPEED_MPS = 1.3888888888;

/** Default maximum walking time in seconds (20 minutes). */
export const DEFAULT_MAX_WALKING_TIME_SECONDS = 1200;

/** Default decay function parameters: power decay with beta = 1.5. */
export const DEFAULT_DECAY_PARAMETERS: DecayFunctionParameters = {
    type: 'power',
    beta: 1.5
};

/**
 * Default intrinsic weight for a POI or OD point when the source file
 * does not provide a weight column (or the value is missing/invalid).
 */
export const DEFAULT_INTRINSIC_WEIGHT = 1.0;

/**
 * Parameters controlling how node accessibility weights are calculated
 * from a single weighted point (POI, OD origin, or OD destination).
 *
 * The algorithm:
 * 1. Pre-filters nodes within a bird-distance radius derived from
 *    maxWalkingTimeSeconds * walkingSpeedMps.
 * 2. Queries OSRM walking profile for actual travel times to pre-filtered nodes.
 * 3. Applies the decay function to each travel time within the cutoff:
 *    accessibilityWeightIncrement = intrinsicWeight * f(travelTime)
 *
 * See docs/weighting/IntrinsicAndAccessibilityWeights.md for terminology.
 */
export type NodeWeightingParameters = {
    maxWalkingTimeSeconds: number;
    decayFunctionParameters: DecayFunctionParameters;
    /** Walking speed for the bird-distance pre-filter (defaults to DEFAULT_WALKING_SPEED_MPS). */
    walkingSpeedMps?: number;
};

/**
 * Accessibility weight increment for a single transit node contributed
 * by one weighted point.  Only nodes with a positive increment are returned.
 *
 * accessibilityWeightIncrement = intrinsicWeight(point) * decayFunction(travelTime)
 *
 * See docs/weighting/IntrinsicAndAccessibilityWeights.md for the full
 * distinction between intrinsic weights and accessibility weights.
 */
export type NodeAccessibilityWeightIncrement = {
    nodeId: string;
    accessibilityWeightIncrement: number;
    travelTimeSeconds: number;
    distanceMeters: number;
};

/**
 * Minimal node feature required by the weight calculator.
 * The id field in properties must be the node's UUID.
 */
export type NodeFeatureForWeighting = GeoJSON.Feature<GeoJSON.Point, { id: string }>;

/**
 * Function signature for querying nodes within a bird-distance radius of a point.
 * Abstracted to allow both PostGIS-backed and in-memory implementations.
 */
export type GetNodesInBirdDistanceFromPointFn = (
    point: GeoJSON.Point,
    distanceMeters: number
) => Promise<{ id: string; distance: number }[]>;

/**
 * Minimal interface exposing only the tableManyToMany method needed by
 * the node accessibility weight calculator. This avoids requiring the full
 * RoutingService interface and enables type-safe adapters.
 */
export interface TableManyToManyService {
    /**
     * Compute the durations and distances of the fastest routes between
     * every (origin, destination) pair -- a full M x N matrix.
     *
     * @param params origins and destinations point features
     * @returns 2D arrays where results[i][j] corresponds to
     *          origins[i] -> destinations[j]. Null when no route exists.
     */
    tableManyToMany(params: TableManyToManyParameters): Promise<TableManyToManyResults>;
}

/**
 * Dependencies injected into the node accessibility weight calculator.
 * Decouples the core algorithm from infrastructure (DB, routing engine).
 */
export type NodeAccessibilityWeightCalculatorDependencies = {
    routingService: TableManyToManyService;
    getNodesInBirdDistanceFromPoint: GetNodesInBirdDistanceFromPointFn;
};
