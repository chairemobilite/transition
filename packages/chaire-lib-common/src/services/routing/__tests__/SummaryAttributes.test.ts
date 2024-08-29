/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validateAndCreateSummaryAttributes } from "../SummaryAttributes";
import each from 'jest-each';

const origin = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [0, 0]
    },
    properties: {}
};
const destination = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [1, 1]
    },
    properties: {}
};

describe('createSummaryAttributes', () => {
    each([
        [
            'a few params', 
            {
                scenarioId: 'ID',
                originGeojson: origin,
                destinationGeojson: destination,
                departureTimeSecondsSinceMidnight: 20000,
                minWaitingTimeSeconds: 100,
                maxAccessTravelTimeSeconds: 200,
                maxEgressTravelTimeSeconds: 300,
                withAlternatives: true
            }, {
                scenarioId: 'ID',
                timeOfTrip: 20000,
                timeOfTripType: 'departure',
                originDestination: [origin, destination],
                minWaitingTime: 100,
                maxAccessTravelTime: 200,
                maxEgressTravelTime: 300,
                alternatives: true
            }
        ], [
            'minimal params', 
            {
                scenarioId: 'ID',
                originGeojson: origin,
                destinationGeojson: destination
            }, {
                scenarioId: 'ID',
                timeOfTrip: 0,
                timeOfTripType: 'departure',
                originDestination: [origin, destination]
            }
        ], [
            'all params', 
            {
                scenarioId: 'ID',
                originGeojson: origin,
                destinationGeojson: destination,
                arrivalTimeSecondsSinceMidnight: 10000,
                departureTimeSecondsSinceMidnight: 20000,
                minWaitingTimeSeconds: 100,
                maxAccessTravelTimeSeconds: 200,
                maxEgressTravelTimeSeconds: 300,
                maxTransferTravelTimeSeconds: 400,
                maxTotalTravelTimeSeconds: 500,
                maxFirstWaitingTimeSeconds: 600,
                withAlternatives: true
            }, {
                scenarioId: 'ID',
                timeOfTrip: 10000,
                timeOfTripType: 'arrival',
                originDestination: [origin, destination],
                minWaitingTime: 100,
                maxAccessTravelTime: 200,
                maxEgressTravelTime: 300,
                maxTransferTravelTime: 400,
                maxTravelTime: 500,
                maxFirstWaitingTime: 600,
                alternatives: true
            }
        ]
    ]).test('valid parameters: %s', (_title, partialAttributes: any, expectedAttributes) => {
        const result = validateAndCreateSummaryAttributes(partialAttributes);
        expect(result).toEqual(expectedAttributes);
    });

    each([
        [
            'origin', {
                scenarioId: 'ID',
                destinationGeojson: destination
            }
        ], [
            'destination', {
                scenarioId: 'ID',
                originGeojson: origin,
            }
        ], [
            'scenario ID', {
                originGeojson: origin,
                destinationGeojson: destination
            }
        ], [
            'all', { }
        ]
        // Add more invalid attribute combinations here
    ]).test('Missing mandatory parameter: %s', (_title, partialAttributes: any) => {
        expect(() => validateAndCreateSummaryAttributes(partialAttributes)).toThrow(Error);
    });

    each([
        [
            'origin, destination',
            {
                originGeojson: { type: 'Point', coordinates: [0, 0]},
                destinationGeojson: 'Not a geojson'
            }
        ],
        [
            'time since midnight',
            {
                arrivalTimeSecondsSinceMidnight: -1,
                departureTimeSecondsSinceMidnight: '1 billion'
            }
        ],
        [
            'scenario ID',
            {
                scenarioId: 12345
            }
        ],
        [
            'transit attributes',
            {
                minWaitingTimeSeconds: '300',
                maxAccessTravelTimeSeconds: { value: 300 },
                maxEgressTravelTimeSeconds: [ 0, 30],
                maxTransferTravelTimeSeconds: false,
                maxTotalTravelTimeSeconds: -100,
                maxFirstWaitingTimeSeconds: 50.6
            }
        ], [
            'alternatives',
            {
                withAlternatives: 'true'
            }
        ],
        // Add more invalid attribute combinations here
    ]).test('Invalid parameter: %s', (_title, erroneousAttributes: any) => {
        const partialAttributes = Object.assign({
            scenarioId: 'ID',
            originGeojson: origin,
            destinationGeojson: destination,
            departureTimeSecondsSinceMidnight: 20000,
            minWaitingTimeSeconds: 100,
            maxAccessTravelTimeSeconds: 200,
            maxEgressTravelTimeSeconds: 300,
            withAlternatives: true
        }, erroneousAttributes);
        let error: Error | null = null;
        try {
            validateAndCreateSummaryAttributes(partialAttributes);
        } catch (e) {
            error = e as Error;
        }
        expect(error).toBeDefined();
        Object.keys(erroneousAttributes).forEach((key) => expect((error as Error).message).toContain(key));
    });
})
