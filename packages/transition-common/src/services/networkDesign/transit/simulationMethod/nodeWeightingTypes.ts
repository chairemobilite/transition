/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import type { CsvFileAndMapping, CsvFieldMappingDescriptor } from '../../../csv';
import { CsvFileAndFieldMapper } from '../../../csv';
import type { DecayFunctionParameters, PowerDecayParameters } from '../../../weighting/types';

/**
 * POI format for separate weighting file: point (lat/lon with projection) and optional weight (one point per row).
 * Uses latLon mapping: pointLat, pointLon and projection. When weight column is missing or unmapped, it is treated as 1.
 */
export type NodeWeightingPoiCsvAttributes = {
    projection: string;
    pointLat: string;
    pointLon: string;
    /** Optional; when missing or unmapped, coalesces to NODE_WEIGHTING_DEFAULT_POI_WEIGHT. */
    weight?: string;
};

/** Default weight for a POI row when the weight column is missing or unmapped.
 * Since this is an intrinsic weight associated with a single POI or trip destination,
 * we can set it to 1 even if the weighting process can give a total weight for a node < 1
 * after applying the decay function to the intrinsic weight
 */
export const NODE_WEIGHTING_DEFAULT_POI_WEIGHT = 1;

export type NodeWeightingPoiFileAttributes = CsvFileAndMapping<NodeWeightingPoiCsvAttributes>;

/**
 * Source of data for node weighting: same demand file, or separate POI file.
 */
export type NodeWeightingSourceType = 'sameFile' | 'separateFile';

/**
 * When using OD data, which points to use for weighting.
 */
export type NodeWeightingOdPointsType = 'origins' | 'destinations' | 'both';

/**
 * Node weighting configuration for transit network design.
 * Optional; when undefined or weightingEnabled false, no weighting is run.
 */
export type NodeWeightingConfig = {
    /** Whether to run node weighting (manual "Start weighting" in the form). */
    weightingEnabled: boolean;
    /** Use same demand file (OD mapping) or separate file (POI lat, lon, weight). */
    weightingSource: NodeWeightingSourceType;
    /** When using OD data, which points to use. */
    odWeightingPoints: NodeWeightingOdPointsType;
    /** Max walking time in seconds for "nodes within 20 min" (e.g. 1200). */
    maxWalkingTimeSeconds: number;
    /** Decay function and parameters (defaults in form; user can modify). Reuses transition-common weighting types. */
    decayFunctionParameters: DecayFunctionParameters;
    /**
     * When weightingSource === 'separateFile', the POI file (lat, lon, weight).
     * Required when separateFile is selected.
     */
    weightingFileAttributes?: NodeWeightingPoiFileAttributes;
};

/** Default max walking time: 20 minutes. */
export const NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS = 20 * 60;

/** Default decay: power with beta 1.5 (to be tuned with testing). */
export const NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS: PowerDecayParameters = {
    type: 'power',
    beta: 1.5
};

/**
 * CSV field mapping descriptors for the POI weighting file (separate file only).
 * Point uses latLon (pointLat, pointLon + projection). Optional weight (default 1 when missing).
 */
export const nodeWeightingPoiMappingDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'point',
        i18nLabel: 'transit:networkDesign.nodeWeighting.poiFieldPoint',
        i18nErrorLabel: 'transit:networkDesign.nodeWeighting.errors.poiFieldPointMissing',
        type: 'latLon',
        required: true
    },
    {
        key: 'weight',
        i18nLabel: 'transit:networkDesign.nodeWeighting.poiFieldWeight',
        type: 'single',
        required: false
    }
];

/**
 * CSV file and field mapper for the POI weighting file (point lat/lon + projection, optional weight).
 * Used to validate weightingFileAttributes when weightingSource is 'separateFile'.
 */
export class NodeWeightingPoiFromCsv extends CsvFileAndFieldMapper<NodeWeightingPoiCsvAttributes> {
    constructor(csvFileAndMapping?: NodeWeightingPoiFileAttributes) {
        super(nodeWeightingPoiMappingDescriptors, csvFileAndMapping);
    }
}
