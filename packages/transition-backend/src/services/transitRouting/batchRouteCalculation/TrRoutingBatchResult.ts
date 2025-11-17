/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import _omit from 'lodash/omit';
import _cloneDeep from 'lodash/cloneDeep';

import { TrRoutingV2 } from 'chaire-lib-common/lib/api/TrRouting';
import { SegmentToGeoJSONFromPaths } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { getDefaultCsvAttributes, getDefaultStepsAttributes } from '../ResultAttributes';
import { OdTripRouteOutput, OdTripRouteResult } from '../types';
import { unparse } from 'papaparse';
import { ErrorCodes, TrRoutingRoute } from 'chaire-lib-common/lib/services/transitRouting/types';
import { TransitRoutingResultData } from 'chaire-lib-common/lib/services/routing/TransitRoutingResult';
import { routeToUserObject } from 'chaire-lib-common/lib/services/transitRouting/TrRoutingResultConversion';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { RoutingOrTransitMode } from 'chaire-lib-common/lib/config/routingModes';
import { BatchCalculationParameters } from 'transition-common/lib/services/batchCalculation/types';
import { pathIsRoute } from 'chaire-lib-common/lib/services/routing/RoutingResult';
import { RoutingResultsByMode } from 'chaire-lib-common/lib/services/routing/types';
import { resultToObject } from 'chaire-lib-common/lib/services/routing/RoutingResultUtils';
import { ExecutableJob } from '../../executableJob/ExecutableJob';
import { BatchRouteJobType } from '../BatchRoutingJob';

const CSV_FILE_NAME = 'batchRoutingResults.csv';
const DETAILED_CSV_FILE_NAME = 'batchRoutingDetailedResults.csv';
const GEOMETRY_FILE_NAME = 'batchRoutingGeometryResults.geojson';

export interface BatchRoutingResultProcessor {
    processResult: (routingResult: OdTripRouteOutput) => void;
    end: () => void;
    getFiles: () => { input: string; csv?: string; detailedCsv?: string; geojson?: string };
}

/**
 * Factory method to create a batch routing result processor to files
 *
 */
export const createRoutingFileResultProcessor = (
    job: ExecutableJob<BatchRouteJobType>
): BatchRoutingResultProcessor => {
    return new BatchRoutingResultProcessorFile(job);
};

class BatchRoutingResultProcessorFile implements BatchRoutingResultProcessor {
    private batchParameters: BatchCalculationParameters = this.job.attributes.data.parameters.transitRoutingAttributes;
    private csvStream: fs.WriteStream | undefined;
    private csvDetailedStream: fs.WriteStream | undefined;
    private geometryStream: fs.WriteStream | undefined;
    private geometryStreamHasData = false;

    constructor(private job: ExecutableJob<BatchRouteJobType>) {
        this.initResultFiles();
    }

    private initResultFiles = () => {
        const csvAttributes = getDefaultCsvAttributes(this.batchParameters.routingModes || []);

        // Register CSV output file
        this.job.registerOutputFile('csv', CSV_FILE_NAME);
        this.csvStream = this.job.getWriteStream('csv');
        this.csvStream.on('error', console.error);
        this.csvStream.write(Object.keys(csvAttributes).join(',') + '\n');

        if (this.batchParameters.detailed) {
            this.job.registerOutputFile('detailedCsv', DETAILED_CSV_FILE_NAME);
            this.csvDetailedStream = this.job.getWriteStream('detailedCsv');
            this.csvDetailedStream.on('error', console.error);
            this.csvDetailedStream.write(Object.keys(getDefaultStepsAttributes()).join(',') + '\n');
        }

        if (this.batchParameters.withGeometries) {
            this.job.registerOutputFile('geojson', GEOMETRY_FILE_NAME);
            this.geometryStream = this.job.getWriteStream('geojson');
            this.geometryStream.on('error', console.error);
            this.geometryStream.write('{ "type": "FeatureCollection", "features": [');
        }
    };

    processResult = (routingResult: OdTripRouteOutput) => {
        if (this.geometryStream && routingResult.geometries && routingResult.geometries.length > 0) {
            // Write the geometry in the stream
            this.geometryStream.write(
                (this.geometryStreamHasData ? ',\n' : '\n') +
                    routingResult.geometries.map((geometry) => JSON.stringify(geometry)).join(',\n')
            );
            this.geometryStreamHasData = true;
        }
        if (this.csvStream && routingResult.csv && routingResult.csv.length > 0) {
            this.csvStream.write(routingResult.csv.join('\n') + '\n');
        }
        if (this.csvDetailedStream && routingResult.csvDetailed && routingResult.csvDetailed.length > 0) {
            this.csvDetailedStream.write(routingResult.csvDetailed.join('\n') + '\n');
        }
    };

    end = () => {
        if (this.csvStream) {
            this.csvStream.end();
        }
        if (this.csvDetailedStream) {
            this.csvDetailedStream.end();
        }
        if (this.geometryStream) {
            this.geometryStream.write('\n]}');
            this.geometryStream.end();
        }
    };

    getFiles = () => ({
        input: this.job.getInputFileName(),
        csv: CSV_FILE_NAME,
        detailedCsv: this.batchParameters.detailed ? DETAILED_CSV_FILE_NAME : undefined,
        geojson: this.batchParameters.withGeometries ? GEOMETRY_FILE_NAME : undefined
    });
}

export const generateFileOutputResults = async (
    result: OdTripRouteResult,
    options: {
        exportCsv: boolean;
        exportDetailed: boolean;
        withGeometries: boolean;
        pathCollection?: PathCollection;
    } = { exportCsv: true, exportDetailed: false, withGeometries: false }
): Promise<{ csv: string[]; csvDetailed: string[]; geometries: GeoJSON.Feature[] }> => {
    const routingModes = result.results ? (Object.keys(result.results) as RoutingOrTransitMode[]) : [];
    const csvResultAttributes = getDefaultCsvAttributes(routingModes);
    csvResultAttributes.uuid = result.uuid;
    csvResultAttributes.internalId = result.internalId;

    if (result.destination === undefined || result.origin === undefined) {
        // This trip was invalid, skip this line
        return { csv: [], csvDetailed: [], geometries: [] };
    }
    if (result.results === undefined) {
        // Otherwise, generate error row
        return {
            csv: [generateCsvErrorRow(result.error, csvResultAttributes, result.results)],
            csvDetailed: [],
            geometries: []
        };
    }
    const { csv, csvDetailed } = generateCsvContent(result.results, csvResultAttributes, {
        uuid: result.uuid,
        internalId: result.internalId,
        origin: result.origin,
        destination: result.destination,
        exportCsv: options.exportCsv,
        exportCsvDetailed: options.exportDetailed
    });
    const geometries =
        options.withGeometries && options.pathCollection
            ? await generateShapeGeojsons(result.results, { internalId: result.internalId }, options.pathCollection)
            : [];
    return {
        csv,
        csvDetailed,
        geometries
    };
};

const generateCsvContent = (
    results: RoutingResultsByMode,
    csvAttributes: { [key: string]: string | number | null },
    options: {
        uuid: string;
        internalId: string;
        origin: GeoJSON.Point;
        destination: GeoJSON.Point;
        exportCsv: boolean;
        exportCsvDetailed: boolean;
    }
): { csv: string[]; csvDetailed: string[] } => {
    if (options.exportCsv !== true) {
        return {
            csv: [],
            csvDetailed: []
        };
    }

    csvAttributes.originLat = options.origin.coordinates[1];
    csvAttributes.originLon = options.origin.coordinates[0];
    csvAttributes.destinationLat = options.destination.coordinates[1];
    csvAttributes.destinationLon = options.destination.coordinates[0];

    const transitResult = results.transit;
    if (transitResult !== undefined) {
        return generateCsvWithTransit(transitResult, results, csvAttributes, {
            exportCsvDetailed: options.exportCsvDetailed
        });
    }

    const csvContent: string[] = [];

    addAdditionalModes(results, csvAttributes);
    csvContent.push(unparse([csvAttributes], { header: false }));

    return {
        csv: csvContent,
        csvDetailed: []
    };
};

const getStepSummaries = (
    result: Partial<TrRoutingRoute>
): {
    lineUuids: string;
    modes: string;
    stepsSummary: string;
} => {
    const steps = result.steps || [];
    const lineUuids = steps
        .filter((step) => step.action === 'boarding')
        .map((step) => (step as TrRoutingV2.TripStepBoarding).lineUuid)
        .join('|');
    const modes = steps
        .filter((step) => step.action === 'boarding')
        .map((step) => (step as TrRoutingV2.TripStepBoarding).mode)
        .join('|');
    const stepsSummary = steps
        .map((step) => {
            switch (step.action) {
            case 'boarding':
                return `wait${(step as TrRoutingV2.TripStepBoarding).waitingTime}s`;
            case 'unboarding':
                return `ride${(step as TrRoutingV2.TripStepUnboarding).inVehicleTime}s${
                    (step as TrRoutingV2.TripStepUnboarding).inVehicleDistance
                }m`;
            case 'walking':
                return `${(step as TrRoutingV2.TripStepWalking).type}${
                    (step as TrRoutingV2.TripStepWalking).travelTime
                }s${(step as TrRoutingV2.TripStepWalking).distance}m`;
            }
        })
        .join('|');
    return { lineUuids, modes, stepsSummary };
};

const generateCsvWithTransit = (
    transitResultData: TransitRoutingResultData,
    results: RoutingResultsByMode,
    preFilledCsvAttributes: { [key: string]: string | number | null },
    options: { exportCsvDetailed: boolean }
): { csv: string[]; csvDetailed: string[] } => {
    const csvContent: string[] = [];
    const csvDetailedContent: string[] = [];
    const transitResult = resultToObject(transitResultData);

    if (transitResult.hasError()) {
        return {
            csv: [generateCsvErrorRow(transitResult.getError(), preFilledCsvAttributes, results)],
            csvDetailed: []
        };
    }
    let alternativeSequence = 0;
    for (let i = 0, countI = transitResult.getAlternativesCount(); i < countI; i++) {
        const alternative = transitResult.getPath(i);
        if (pathIsRoute(alternative) || alternative === undefined) {
            // This is the walk only path
            continue;
        }
        alternativeSequence++;
        const stepsDetailSummary = getStepSummaries(alternative);
        const userResult = routeToUserObject(alternative);
        const { origin, destination, ...rest } = userResult;
        const csvAttributes = Object.assign(_cloneDeep(preFilledCsvAttributes), stepsDetailSummary);
        // replace origin and destination coordinates arrays by separate lat/lon values:
        // TODO csvAttributes will need to be typed
        csvAttributes.originLat = origin[1];
        csvAttributes.originLon = origin[0];
        csvAttributes.destinationLat = destination[1];
        csvAttributes.destinationLon = destination[0];
        csvAttributes.alternativeSequence = alternativeSequence;
        csvAttributes.alternativeTotalSequence = transitResult.getAlternativesCount();
        csvAttributes.status = 'success';

        for (const attribute in _omit(rest, ['steps'])) {
            if (csvAttributes[attribute] !== undefined) {
                csvAttributes[attribute] = rest[attribute];
            } else {
                console.error(
                    `csvAttributes is missing ${attribute} attribute which was returned by trRouting (it will be ignored)`
                );
            }
        }
        addAdditionalModes(results, csvAttributes);
        csvContent.push(unparse([csvAttributes], { header: false }));

        if (options.exportCsvDetailed === true) {
            const steps = userResult.steps;
            if (steps) {
                for (let j = 0, countJ = steps.length; j < countJ; j++) {
                    const step = steps[j];
                    // TODO Is this needed?
                    /*if (step.action === 'unboard' && step.inVehicleDistanceMeters && step.inVehicleDistanceMeters === -1)
                            {
                            step.inVehicleDistanceMeters = null;
                            } */
                    const csvDetailedAttributes = getDefaultStepsAttributes();
                    csvDetailedAttributes.uuid = preFilledCsvAttributes.uuid;
                    csvDetailedAttributes.internalId = preFilledCsvAttributes.internalId;
                    csvDetailedAttributes.alternativeSequence = alternativeSequence;
                    csvDetailedAttributes.stepSequence = j + 1;
                    for (const attribute in step) {
                        if (csvDetailedAttributes[attribute] !== undefined) {
                            csvDetailedAttributes[attribute] = step[attribute];
                        } else {
                            console.error(
                                `csvDetailedAttributes is missing ${attribute} attribute which was returned by trRouting (it will be ignored)`
                            );
                        }
                    }
                    csvDetailedContent.push(unparse([csvDetailedAttributes], { header: false }));
                }
            }
        }
    }

    return {
        csv: csvContent,
        csvDetailed: csvDetailedContent
    };
};

const generateCsvErrorRow = (
    error: any,
    csvAttributes: { [key: string]: string | number | null },
    results?: RoutingResultsByMode
): string => {
    csvAttributes.status = error !== undefined && TrError.isTrError(error) ? error.getCode() : 'error';

    if (error !== undefined && TrError.isTrError(error) && error.getCode() === ErrorCodes.OtherError) {
        console.error(`cannot calculate transit route with trRouting: ${error.message}`);
    }

    if (results) {
        addAdditionalModes(results, csvAttributes);
    }

    return unparse([csvAttributes], { header: false });
};

const addAdditionalModes = (
    results: RoutingResultsByMode,
    csvAttributes: { [key: string]: string | number | null }
) => {
    // Add the value of the time for each mode
    Object.keys(results).forEach((key) => {
        if (key !== 'transit' && results[key]) {
            const resultForMode = resultToObject(results[key]);
            const pathForMode = !resultForMode.hasError() ? (resultForMode.getPath(0) as Route) : undefined;
            csvAttributes[`only${key.charAt(0).toUpperCase() + key.slice(1)}TravelTimeSeconds`] = pathForMode
                ? pathForMode.duration
                : resultForMode.getError()?.getCode() || null;
            csvAttributes[`only${key.charAt(0).toUpperCase() + key.slice(1)}DistanceMeters`] = pathForMode
                ? pathForMode.distance
                : null;
        }
    });
};

const generateShapeGeojsons = async (
    results: RoutingResultsByMode,
    options: { internalId: string },
    pathCollection: PathCollection
): Promise<GeoJSON.Feature[]> => {
    let features: GeoJSON.Feature[] = [];
    const segmentToGeojson = new SegmentToGeoJSONFromPaths(pathCollection);
    const modes = Object.keys(results);
    for (let modeIndex = 0; modeIndex < modes.length; modeIndex++) {
        const result = resultToObject(results[modes[modeIndex]]);
        try {
            for (let i = 0, alternativeCount = result.getAlternativesCount(); i < alternativeCount; i++) {
                const featureColl = await result.getPathGeojson(i, {
                    completeData: true,
                    segmentToGeojson: segmentToGeojson.segmentToGeoJSONFromPaths
                });
                features = features.concat(
                    featureColl.features.map((feature) => ({
                        type: 'Feature',
                        properties: {
                            alternative: i,
                            internalId: options.internalId,
                            routingMode: modes[modeIndex],
                            ...feature.properties
                        },
                        geometry: feature.geometry
                    }))
                );
            }
        } catch (error) {
            console.error(`Error generating geojson path for mode ${modes[modeIndex]}: ${error}`);
        }
    }

    return features;
};
