/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { feature as turfFeature } from '@turf/turf';
import _omit from 'lodash.omit';
import _cloneDeep from 'lodash.clonedeep';
import { unparse } from 'papaparse';

import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
import {
    TransitRoutingCalculator,
    ResultsByMode
} from 'transition-common/lib/services/transitRouting/TransitRoutingCalculator';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import {
    steps as allCsvDetailedAttributes,
    base as baseAttributes,
    transit as transitAttributes
} from '../../config/trRoutingAttributes';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import PathCollection from 'transition-common/lib/services/path/PathCollection';
import { Route } from 'chaire-lib-common/lib/services/routing/RoutingService';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { ErrorCodes } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import {
    TrRoutingPath,
    TrRoutingBoardingStep,
    TrRoutingWalkingStep,
    TrRoutingUnboardingStep
} from 'chaire-lib-common/lib/api/TrRouting';
// TODO Should this file go in the backend?

interface RouteOdTripParameters {
    routing: TransitRouting;
    trRoutingPort?: number;
    odTripIndex: number;
    odTripsCount: number;
    exportCsv: boolean;
    exportCsvDetailed: boolean;
    withGeometries: boolean;
    reverseOD: boolean;
    /**
     * The collection of paths used in the scenario, required only if the
     * geojson geometries are to be calculated
     *
     * @type {PathCollection}
     * @memberof RouteOdTripParameters
     */
    pathCollection?: PathCollection;
}

const routeOdTrip = async function(
    odTrip: BaseOdTrip,
    parameters: RouteOdTripParameters
): Promise<{ csv?: string[]; csvDetailed?: string[]; geometries?: GeoJSON.Feature[]; result?: TransitRoutingResult }> {
    const routingAttributes: TransitRoutingAttributes = Object.assign({}, parameters.routing.getAttributes());
    // TODO Manage routing port in a better way
    (routingAttributes as any).routingPort = parameters.trRoutingPort;

    const origin = parameters.reverseOD ? odTrip.attributes.destination_geography : odTrip.attributes.origin_geography;
    const destination = parameters.reverseOD
        ? odTrip.attributes.origin_geography
        : odTrip.attributes.destination_geography;

    if (!origin || !origin.coordinates || !destination || !destination.coordinates) {
        return {
            csv: parameters.exportCsv ? [] : undefined,
            csvDetailed: parameters.exportCsvDetailed ? [] : undefined,
            geometries: parameters.withGeometries ? [] : undefined
        };
    }

    const originGeojson = turfFeature(origin);
    const destinationGeojson = turfFeature(destination);

    routingAttributes.originGeojson = originGeojson;
    routingAttributes.destinationGeojson = destinationGeojson;

    routingAttributes.arrivalTimeSecondsSinceMidnight =
        odTrip.attributes.timeType === 'arrival' ? odTrip.attributes.timeOfTrip : undefined;
    routingAttributes.departureTimeSecondsSinceMidnight =
        odTrip.attributes.timeType === 'departure' ? odTrip.attributes.timeOfTrip : undefined;

    const uuid = odTrip.getId();
    const internalId = odTrip.attributes.internal_id || '';

    try {
        const results: ResultsByMode = await TransitRoutingCalculator.calculate(
            new TransitRouting(routingAttributes),
            false
        );

        console.log(
            `odTrip ${parameters.odTripIndex + 1}/${parameters.odTripsCount} transit routed @port ${
                parameters.trRoutingPort
            }`
        );

        let features: GeoJSON.Feature[] | undefined = undefined;
        if (parameters.withGeometries === true) {
            features = await generateShapeGeojsons(
                results,
                {
                    internalId
                },
                parameters.pathCollection
            );
        }

        const { csv, csvDetailed } = generateCsvContent(results, {
            uuid,
            internalId,
            origin,
            destination,
            exportCsv: parameters.exportCsv,
            exportCsvDetailed: parameters.exportCsvDetailed
        });

        return {
            csv: parameters.exportCsv ? csv : undefined,
            csvDetailed: parameters.exportCsvDetailed ? csvDetailed : undefined,
            geometries: features,
            result: results.transit
        };
    } catch (error) {
        return {
            csv: parameters.exportCsv ? [generateCsvErrorRow(error, { uuid, internalId })] : undefined,
            csvDetailed: parameters.exportCsvDetailed ? [] : undefined,
            geometries: parameters.withGeometries ? [] : undefined,
            result: undefined
        };
    }
};

const generateCsvContent = (
    results: ResultsByMode,
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

    const csvAttributes = _cloneDeep(baseAttributes);
    csvAttributes.originLat = options.origin.coordinates[1];
    csvAttributes.originLon = options.origin.coordinates[0];
    csvAttributes.destinationLat = options.destination.coordinates[1];
    csvAttributes.destinationLon = options.destination.coordinates[0];
    csvAttributes.uuid = options.uuid;
    csvAttributes.internalId = options.internalId;

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
    result: Partial<TrRoutingPath>
): {
    lineUuids: string;
    modes: string;
    stepsSummary: string;
} => {
    const steps = result.steps || [];
    const lineUuids = steps
        .filter((step) => step.action === 'board')
        .map((step) => (step as TrRoutingBoardingStep).lineUuid)
        .join('|');
    const modes = steps
        .filter((step) => step.action === 'board')
        .map((step) => (step as TrRoutingBoardingStep).mode)
        .join('|');
    const stepsSummary = steps
        .map((step) => {
            switch (step.action) {
            case 'board':
                return `wait${(step as TrRoutingBoardingStep).waitingTimeSeconds}s`;
            case 'unboard':
                return `ride${(step as TrRoutingUnboardingStep).inVehicleTimeSeconds}s${
                    (step as TrRoutingUnboardingStep).inVehicleDistanceMeters
                }m`;
            case 'walking':
                return `${(step as TrRoutingWalkingStep).type}${(step as TrRoutingWalkingStep).travelTimeSeconds}s${
                    (step as TrRoutingWalkingStep).distanceMeters
                }m`;
            }
        })
        .join('|');
    return { lineUuids, modes, stepsSummary };
};

const generateCsvWithTransit = (
    transitResult: TransitRoutingResult,
    results: ResultsByMode,
    preFilledCsvAttributes: { [key: string]: string | number | null },
    options: { exportCsvDetailed: boolean }
): { csv: string[]; csvDetailed: string[] } => {
    const csvContent: string[] = [];
    const csvDetailedContent: string[] = [];

    if (transitResult.hasError()) {
        return {
            csv: [generateCsvErrorRow(transitResult.getError(), preFilledCsvAttributes, results)],
            csvDetailed: []
        };
    }
    let alternativeSequence = 0;
    for (let i = 0, countI = transitResult.getAlternativesCount(); i < countI; i++) {
        const alternative = transitResult.getPath(i);
        if (alternative === undefined) {
            // This is the walk only path
            continue;
        }
        alternativeSequence++;
        const stepsDetailSummary = getStepSummaries(alternative);
        const { origin, destination, ...rest } = alternative;
        const csvAttributes = Object.assign(
            _cloneDeep(preFilledCsvAttributes),
            _cloneDeep(transitAttributes),
            stepsDetailSummary
        );
        // replace origin and destination coordinates arrays by separate lat/lon values:
        if (
            alternative.origin &&
            alternative.destination &&
            !_isBlank(alternative.origin[1]) &&
            !_isBlank(alternative.origin[0]) &&
            !_isBlank(alternative.destination[1]) &&
            !_isBlank(alternative.destination[0])
        ) {
            // TODO csvAttributes will need to be typed
            csvAttributes.originLat = origin[1];
            csvAttributes.originLon = origin[0];
            csvAttributes.destinationLat = destination[1];
            csvAttributes.destinationLon = destination[0];
        }

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
            const steps = alternative.steps;
            if (steps) {
                for (let j = 0, countJ = steps.length; j < countJ; j++) {
                    const step = steps[j];
                    // TODO Is this needed?
                    /*if (step.action === 'unboard' && step.inVehicleDistanceMeters && step.inVehicleDistanceMeters === -1)
                            {
                            step.inVehicleDistanceMeters = null;
                            } */
                    const csvDetailedAttributes = _cloneDeep(allCsvDetailedAttributes);
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
    results?: ResultsByMode
): string => {
    Object.assign(csvAttributes, _cloneDeep(transitAttributes));
    csvAttributes.status = TrError.isTrError(error) ? error.getCode() : 'error';

    if (TrError.isTrError(error) && error.getCode() === ErrorCodes.OtherError) {
        console.error(`cannot calculate transit route with trRouting: ${error.message}`);
    }

    if (results) {
        addAdditionalModes(results, csvAttributes);
    }

    return unparse([csvAttributes], { header: false });
};

const addAdditionalModes = (results: ResultsByMode, csvAttributes: { [key: string]: string | number | null }) => {
    // Add the value of the time for each mode
    Object.keys(results).forEach((key) => {
        if (key !== 'transit' && results[key]) {
            const resultForMode = results[key];
            const pathForMode = !resultForMode.hasError() ? (resultForMode.getPath(0) as Route) : undefined;
            csvAttributes[`only${key.charAt(0).toUpperCase() + key.slice(1)}TravelTimeSeconds`] = pathForMode
                ? pathForMode.duration
                : resultForMode.getError().getCode();
            csvAttributes[`only${key.charAt(0).toUpperCase() + key.slice(1)}DistanceMeters`] = pathForMode
                ? pathForMode.distance
                : null;
        }
    });
};

const generateShapeGeojsons = async (
    results: ResultsByMode,
    options: { internalId: string },
    pathCollection?: PathCollection
): Promise<GeoJSON.Feature[]> => {
    let features: GeoJSON.Feature[] = [];

    const modes = Object.keys(results);
    for (let modeIndex = 0; modeIndex < modes.length; modeIndex++) {
        const result = results[modes[modeIndex]];
        try {
            for (let i = 0, alternativeCount = result.getAlternativesCount(); i < alternativeCount; i++) {
                const featureColl = await result.getPathGeojson(i, { completeData: true, pathCollection });
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

export default routeOdTrip;
