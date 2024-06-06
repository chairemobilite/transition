/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { ParamsValidatorUtils } from '../../utils/ParamsValidatorUtils';
import TrError from '../../utils/TrError';
import { TripRoutingQueryAttributes } from './types';

// This file contains functions related to the routing attributes

/**
 * This function validates all parameters of a trip routing attributes object
 * and returns a valid one with complete fields or default values. If any
 * parameter is invalid or missing, it throws an Error.
 *
 * @param partialAttributes The partial routing attributes object to validate
 * @returns A valid routing attributes object
 * @throws Error if any parameter is invalid or missing
 */
export const validateAndCreateTripRoutingAttributes = (
    partialAttributes: Partial<TripRoutingQueryAttributes>
): TripRoutingQueryAttributes => {
    // Validate required parameters are present
    const mandatoryErrors: Error[] = [];
    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired('origin', partialAttributes.originGeojson, 'tripRoutingQueryAttributes')
    );
    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired(
            'destination',
            partialAttributes.destinationGeojson,
            'tripRoutingQueryAttributes'
        )
    );
    mandatoryErrors.push(
        ...ParamsValidatorUtils.isRequired(
            'routing modes',
            partialAttributes.routingModes,
            'tripRoutingQueryAttributes'
        )
    );
    if (mandatoryErrors.length > 0) {
        throw new TrError(
            mandatoryErrors.map((e) => e.message).join('\n'),
            'tripRoutingQueryAttributesValidationError'
        );
    }

    const errors: Error[] = [];
    // Validate type of mandatory attributes
    errors.push(
        ...ParamsValidatorUtils.isGeojsonPoint(
            'originGeojson',
            partialAttributes.originGeojson,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isGeojsonPoint(
            'destinationGeojson',
            partialAttributes.destinationGeojson,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isArrayOfStrings(
            'routingModes',
            partialAttributes.routingModes,
            'tripRoutingQueryAttributes'
        )
    );
    // Validate type of other attributes of main routing query
    errors.push(...ParamsValidatorUtils.isString('engine', partialAttributes.engine, 'tripRoutingQueryAttributes'));
    const waypointsErrors = ParamsValidatorUtils.isArray(
        'waypoints',
        partialAttributes.waypoints,
        'tripRoutingQueryAttributes'
    );
    errors.push(...waypointsErrors);
    if (partialAttributes.waypoints && waypointsErrors.length === 0) {
        partialAttributes.waypoints.forEach((waypoint, index) => {
            errors.push(
                ...ParamsValidatorUtils.isGeojsonPoint(`waypoints[${index}]`, waypoint, 'tripRoutingQueryAttributes')
            );
        });
    }
    errors.push(
        ...ParamsValidatorUtils.isBoolean(
            'withAlternatives',
            partialAttributes.withAlternatives,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'timeSecondsSinceMidnight',
            partialAttributes.timeSecondsSinceMidnight,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isString('routingName', partialAttributes.routingName, 'tripRoutingQueryAttributes')
    );
    errors.push(
        ...ParamsValidatorUtils.isIn('timeType', partialAttributes.timeType, 'tripRoutingQueryAttributes', [
            'arrival',
            'departure'
        ])
    );

    // Validate transit routing attribues
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'minWaitingTimeSeconds',
            partialAttributes.minWaitingTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxTransferTravelTimeSeconds',
            partialAttributes.maxTransferTravelTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxAccessEgressTravelTimeSeconds',
            partialAttributes.maxAccessEgressTravelTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxWalkingOnlyTravelTimeSeconds',
            partialAttributes.maxWalkingOnlyTravelTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isInteger(
            'maxFirstWaitingTimeSeconds',
            partialAttributes.maxFirstWaitingTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveInteger(
            'maxTotalTravelTimeSeconds',
            partialAttributes.maxTotalTravelTimeSeconds,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveNumber(
            'walkingSpeedMps',
            partialAttributes.walkingSpeedMps,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isPositiveNumber(
            'walkingSpeedFactor',
            partialAttributes.walkingSpeedFactor,
            'tripRoutingQueryAttributes'
        )
    );
    errors.push(
        ...ParamsValidatorUtils.isString('scenarioId', partialAttributes.scenarioId, 'tripRoutingQueryAttributes')
    );

    if (errors.length > 0) {
        throw new TrError(errors.map((e) => e.message).join('\n'), 'tripRoutingQueryAttributesValidationError');
    }

    // Return a routing attribute object
    return {
        originGeojson: partialAttributes.originGeojson!,
        destinationGeojson: partialAttributes.destinationGeojson!,
        routingModes: partialAttributes.routingModes!,
        engine: partialAttributes.engine,
        timeSecondsSinceMidnight: partialAttributes.timeSecondsSinceMidnight || 0,
        timeType: partialAttributes.timeType || 'departure',
        routingName: partialAttributes.routingName,
        waypoints: partialAttributes.waypoints,
        withAlternatives: partialAttributes.withAlternatives || false,
        minWaitingTimeSeconds: partialAttributes.minWaitingTimeSeconds,
        maxTransferTravelTimeSeconds: partialAttributes.maxTransferTravelTimeSeconds,
        maxAccessEgressTravelTimeSeconds: partialAttributes.maxAccessEgressTravelTimeSeconds,
        maxWalkingOnlyTravelTimeSeconds: partialAttributes.maxWalkingOnlyTravelTimeSeconds,
        maxFirstWaitingTimeSeconds: partialAttributes.maxFirstWaitingTimeSeconds,
        maxTotalTravelTimeSeconds: partialAttributes.maxTotalTravelTimeSeconds,
        walkingSpeedMps: partialAttributes.walkingSpeedMps,
        walkingSpeedFactor: partialAttributes.walkingSpeedFactor,
        scenarioId: partialAttributes.scenarioId
    };
};
