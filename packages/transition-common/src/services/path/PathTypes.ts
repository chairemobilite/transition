/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

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

export type SegmentChangeInfo = {
    lastNodeChange?: TypeNodeChange;
    lastWaypointChangedSegmentIndex?: number;
};
