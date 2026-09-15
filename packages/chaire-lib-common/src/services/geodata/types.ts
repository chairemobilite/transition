/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import GeoJSON from 'geojson';

/**
 * A geographic point carrying an intrinsic weight in its properties.
 *
 * Used wherever a point of interest, OD origin/destination, or any
 * location needs an associated numeric weight for spatial analysis
 * (e.g. gravity models, decay-based weighting, accessibility calculations).
 *
 * The `intrinsicWeight` represents the inherent importance of the point
 * before any spatial decay is applied -- for example a survey expansion
 * factor, a population count, or a job count at that location.
 * When the property is absent or invalid, consumers should fall back
 * to a domain-specific default (typically 1.0).
 * See docs/weighting/IntrinsicAndAccessibilityWeights.md for more information.
 */
export type IntrinsicWeightedPoint = GeoJSON.Feature<
    GeoJSON.Point,
    GeoJSON.GeoJsonProperties & { intrinsicWeight?: number }
>;
