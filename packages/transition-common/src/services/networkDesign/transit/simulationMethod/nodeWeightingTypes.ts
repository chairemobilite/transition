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
 * When using OD data, which points to use for weighting.
 */
export type NodeWeightingOdPointsType = 'origins' | 'destinations' | 'both';

/**
 * Single control for "node weighting input file type" in the standalone Nodes section UI.
 */
export type WeightingInputType = 'poi' | 'odOrigins' | 'odDestinations' | 'odBoth';

/**
 * Derive the display value for the standalone form from backend config.
 * Uses persisted weightingInputType when present; otherwise infers from
 * odWeightingPoints and file mapping shape (POI vs OD).
 */
export function weightingInputTypeFromConfig(config: NodeWeightingConfig): WeightingInputType {
    if (
        config.weightingInputType !== undefined &&
        config.weightingInputType !== null &&
        ['poi', 'odOrigins', 'odDestinations', 'odBoth'].includes(config.weightingInputType)
    ) {
        return config.weightingInputType;
    }
    const points = config.odWeightingPoints;
    const mappings = config.weightingFileAttributes?.fileAndMapping?.fieldMappings as
        | Record<string, string>
        | undefined;
    const hasOdColumns =
        mappings !== undefined && (mappings.originLat !== undefined || mappings.destinationLat !== undefined);

    if (points === 'origins') {
        return 'odOrigins';
    }
    if (points === 'destinations') {
        return 'odDestinations';
    }
    if (hasOdColumns && points === 'both') {
        return 'odBoth';
    }
    return 'poi';
}

/**
 * Map WeightingInputType (UI) to NodeWeightingOdPointsType (backend).
 */
function weightingInputTypeToOdPoints(inputType: WeightingInputType): NodeWeightingOdPointsType {
    return inputType === 'odOrigins' ? 'origins' : inputType === 'odDestinations' ? 'destinations' : 'both';
}

/**
 * Apply weightingInputType (from standalone form) back onto a config for the backend.
 * Persists weightingInputType so the dropdown stays correct when odWeightingPoints is 'both' (used for both POI and odBoth).
 */
export function applyWeightingInputTypeToConfig(
    config: NodeWeightingConfig,
    inputType: WeightingInputType
): NodeWeightingConfig {
    if (inputType === 'poi') {
        return {
            ...config,
            weightingInputType: 'poi',
            odWeightingPoints: 'both',
            weightingFileAttributes: config.weightingFileAttributes ?? ({} as NodeWeightingPoiFileAttributes)
        };
    }
    return {
        ...config,
        weightingInputType: inputType,
        odWeightingPoints: weightingInputTypeToOdPoints(inputType),
        weightingFileAttributes: config.weightingFileAttributes ?? ({} as NodeWeightingOdFileAttributes)
    };
}

/**
 * Node weighting configuration. All node weighting is configured in the Nodes panel
 * (file type: POI or OD, file, mapping, decay, etc.). Optional weightingFileAttributes
 * when a file is used for weighting.
 */
export type NodeWeightingConfig = {
    /** Whether to run node weighting (manual "Start weighting" in the form). */
    weightingEnabled: boolean;
    /** When using OD file, which points to use. */
    odWeightingPoints: NodeWeightingOdPointsType;
    /** Max walking time in seconds for "nodes within 20 min" (e.g. 1200). Must be > 0. */
    maxWalkingTimeSeconds: number;
    /** Decay function and parameters. */
    decayFunctionParameters: DecayFunctionParameters;
    /** POI file (point lat/lon, weight) or OD file (origin/destination lat/lon, weight). Required when running node weighting from a file. */
    weightingFileAttributes?: NodeWeightingPoiFileAttributes | NodeWeightingOdFileAttributes;
    /** Persisted UI choice: POI vs OD origins/destinations/both. Resolves ambiguity when odWeightingPoints is 'both'. */
    weightingInputType?: WeightingInputType;
};

/** Default max walking time: 20 minutes. */
export const NODE_WEIGHTING_DEFAULT_MAX_WALKING_TIME_SECONDS = 20 * 60;

/** Default decay: power with beta 1.5 (to be tuned with testing). */
export const NODE_WEIGHTING_DEFAULT_DECAY_PARAMETERS: PowerDecayParameters = {
    type: 'power',
    beta: 1.5
};

/**
 * CSV field mapping descriptors for the POI weighting file.
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
 * OD file format for node weighting: origin and/or destination coordinates (o_lat, o_lon, d_lat, d_lon).
 * Used when weighting input type is odOrigins, odDestinations, or odBoth.
 */
export type NodeWeightingOdCsvAttributes = {
    projection: string;
    originLat: string;
    originLon: string;
    destinationLat?: string;
    destinationLon?: string;
    /** Optional weight/expansion factor per row. */
    weight?: string;
};

export type NodeWeightingOdFileAttributes = CsvFileAndMapping<NodeWeightingOdCsvAttributes>;

/** Mapping descriptors when using origins only: o_lat, o_lon and optional weight. */
export const nodeWeightingOdOriginsMappingDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'origin',
        i18nLabel: 'transit:networkDesign.nodeWeighting.odFieldOrigin',
        i18nErrorLabel: 'transit:networkDesign.nodeWeighting.errors.odFieldOriginMissing',
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

/** Mapping descriptors when using destinations only: d_lat, d_lon and optional weight. */
export const nodeWeightingOdDestinationsMappingDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'destination',
        i18nLabel: 'transit:networkDesign.nodeWeighting.odFieldDestination',
        i18nErrorLabel: 'transit:networkDesign.nodeWeighting.errors.odFieldDestinationMissing',
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

/** Mapping descriptors when using both origins and destinations: o_lat, o_lon, d_lat, d_lon and optional weight. */
export const nodeWeightingOdBothMappingDescriptors: CsvFieldMappingDescriptor[] = [
    {
        key: 'origin',
        i18nLabel: 'transit:networkDesign.nodeWeighting.odFieldOrigin',
        i18nErrorLabel: 'transit:networkDesign.nodeWeighting.errors.odFieldOriginMissing',
        type: 'latLon',
        required: true
    },
    {
        key: 'destination',
        i18nLabel: 'transit:networkDesign.nodeWeighting.odFieldDestination',
        i18nErrorLabel: 'transit:networkDesign.nodeWeighting.errors.odFieldDestinationMissing',
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
 * Returns the mapping descriptors for the weighting file based on input type.
 * POI: point (lat/lon) + weight; OD origins: o_lat, o_lon + weight; OD destinations: d_lat, d_lon + weight; OD both: all four + weight.
 */
export function getNodeWeightingMappingDescriptors(inputType: WeightingInputType): CsvFieldMappingDescriptor[] {
    switch (inputType) {
    case 'poi':
        return nodeWeightingPoiMappingDescriptors;
    case 'odOrigins':
        return nodeWeightingOdOriginsMappingDescriptors;
    case 'odDestinations':
        return nodeWeightingOdDestinationsMappingDescriptors;
    case 'odBoth':
        return nodeWeightingOdBothMappingDescriptors;
    default:
        return nodeWeightingPoiMappingDescriptors;
    }
}

/**
 * CSV file and field mapper for the POI weighting file (point lat/lon + projection, optional weight).
 * Used to validate weightingFileAttributes (POI format).
 */
export class NodeWeightingPoiFromCsv extends CsvFileAndFieldMapper<NodeWeightingPoiCsvAttributes> {
    constructor(csvFileAndMapping?: NodeWeightingPoiFileAttributes) {
        super(nodeWeightingPoiMappingDescriptors, csvFileAndMapping);
    }
}
