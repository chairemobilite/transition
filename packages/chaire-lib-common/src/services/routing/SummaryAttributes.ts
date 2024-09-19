/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { ParamsValidatorUtils } from '../../utils/ParamsValidatorUtils';
import TrError from '../../utils/TrError';
import { TransitRouteQueryOptions } from '../../api/TrRouting/base';

// This file contains functions and types related to the summary attributes

// This the type used by a query for the summary API request
export type SummaryQueryAttributes = {
    scenarioId: string;
    originGeojson: GeoJSON.Feature<GeoJSON.Point>;
    destinationGeojson: GeoJSON.Feature<GeoJSON.Point>;
    arrivalTimeSecondsSinceMidnight?: number;
    departureTimeSecondsSinceMidnight?: number;
    minWaitingTimeSeconds?: number;
    maxAccessTravelTimeSeconds?: number;
    maxEgressTravelTimeSeconds?: number;
    maxTransferTravelTimeSeconds?: number;
    maxTotalTravelTimeSeconds?: number;
    maxFirstWaitingTimeSeconds?: number;
    withAlternatives?: boolean;
};

/**
 * This function validates all parameters of a summary attributes object
 * and returns a valid one with complete fields or default values. If any
 * parameter is invalid or missing, it throws an Error.
 *
 * @param summaryAttributes The attributes of the summary query to validate
 * @returns A valid route query options object
 * @throws Error if any parameter is invalid or missing
 */
export const validateAndCreateSummaryAttributes = (
    summaryAttributes: SummaryQueryAttributes
): TransitRouteQueryOptions => {
    // Make sure the geojson features have properties for the validity check
    if (
        summaryAttributes.originGeojson &&
        summaryAttributes.originGeojson.type === 'Feature' &&
        summaryAttributes.originGeojson.properties === undefined
    ) {
        summaryAttributes.originGeojson.properties = {};
    }
    if (
        summaryAttributes.destinationGeojson &&
        summaryAttributes.destinationGeojson.type === 'Feature' &&
        summaryAttributes.destinationGeojson.properties === undefined
    ) {
        summaryAttributes.destinationGeojson.properties = {};
    }

    const timeSecondsSinceMidnight =
        typeof summaryAttributes.arrivalTimeSecondsSinceMidnight === 'number'
            ? summaryAttributes.arrivalTimeSecondsSinceMidnight
            : summaryAttributes.departureTimeSecondsSinceMidnight;

    const timeType = summaryAttributes.arrivalTimeSecondsSinceMidnight !== undefined ? 'arrival' : 'departure';

    // Validatet that required parameters are present
    const mandatoryErrors: Error[] = [];

    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired('scenarioId', summaryAttributes.scenarioId, 'summaryQueryAttributes')
    );

    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired('originGeojson', summaryAttributes.originGeojson, 'summaryQueryAttributes')
    );

    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired(
            'destinationGeojson',
            summaryAttributes.destinationGeojson,
            'summaryQueryAttributes'
        )
    );

    if (mandatoryErrors.length > 0) {
        throw new TrError(mandatoryErrors.map((e) => e.message).join('\n'), 'summaryQueryAttributesValidationError');
    }

    const errors: Error[] = [];
    // Validate type of mandatory attributes
    errors.push(...ParamsValidatorUtils.isString('scenarioId', summaryAttributes.scenarioId, 'summaryQueryAttributes'));

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'timeSecondsSinceMidnight',
            timeSecondsSinceMidnight,
            'summaryQueryAttributes'
        )
    );

    errors.push(...ParamsValidatorUtils.isIn('timeType', timeType, 'summaryQueryAttributes', ['arrival', 'departure']));

    errors.push(
        ...ParamsValidatorUtils.isGeojsonPoint(
            'originGeojson',
            summaryAttributes.originGeojson,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isGeojsonPoint(
            'destinationGeojson',
            summaryAttributes.destinationGeojson,
            'summaryQueryAttributes'
        )
    );

    // Validate type of optional attributes
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'arrivalTimeSecondsSinceMidnight',
            summaryAttributes.arrivalTimeSecondsSinceMidnight,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'departureTimeSecondsSinceMidnight',
            summaryAttributes.departureTimeSecondsSinceMidnight,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'minWaitingTimeSeconds',
            summaryAttributes.minWaitingTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxAccessTravelTimeSeconds',
            summaryAttributes.maxAccessTravelTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxEgressTravelTimeSeconds',
            summaryAttributes.maxEgressTravelTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxTransferTravelTimeSeconds',
            summaryAttributes.maxTransferTravelTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxTotalTravelTimeSeconds',
            summaryAttributes.maxTotalTravelTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isInteger(
            'maxFirstWaitingTimeSeconds',
            summaryAttributes.maxFirstWaitingTimeSeconds,
            'summaryQueryAttributes'
        )
    );

    errors.push(
        ...ParamsValidatorUtils.isBoolean(
            'withAlternatives',
            summaryAttributes.withAlternatives,
            'summaryQueryAttributes'
        )
    );

    if (errors.length > 0) {
        throw new TrError(errors.map((e) => e.message).join('\n'), 'summaryQueryAttributesValidationError');
    }

    // Return a route query options object
    return {
        scenarioId: summaryAttributes.scenarioId,
        timeOfTrip: timeSecondsSinceMidnight || 0,
        timeOfTripType: timeType || 'departure',
        originDestination: [summaryAttributes.originGeojson!, summaryAttributes.destinationGeojson!],
        minWaitingTime: summaryAttributes.minWaitingTimeSeconds,
        maxAccessTravelTime: summaryAttributes.maxAccessTravelTimeSeconds,
        maxEgressTravelTime: summaryAttributes.maxEgressTravelTimeSeconds,
        maxTransferTravelTime: summaryAttributes.maxTransferTravelTimeSeconds,
        maxTravelTime: summaryAttributes.maxTotalTravelTimeSeconds,
        maxFirstWaitingTime: summaryAttributes.maxFirstWaitingTimeSeconds,
        alternatives: summaryAttributes.withAlternatives
    };
};
