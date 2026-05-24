/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

/** Per-segment distance and travel time, used throughout the path system for both OSRM and GTFS-derived times. */
export type TimeAndDistance = {
    distanceMeters: number | null;
    travelTimeSeconds: number;
};

/**
 * Describes a node change on a path: whether a node was inserted or removed, and at which index.
 * Used to remap segment indices when preserving travel times after a node edit.
 */
export type TypeNodeChange = {
    type: 'insert' | 'remove';
    index: number;
};

/** Describes what changed on a path edit, used to decide which segment times to preserve vs. recalculate. */
export type SegmentChangeInfo = {
    lastNodeChange?: TypeNodeChange;
    lastWaypointChangedSegmentIndex?: number;
    /** When true, all segments are recalculated from OSRM instead of preserving previous travel times */
    forceRecalculate?: boolean;
};
