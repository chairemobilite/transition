/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { validateAndCreateTripRoutingAttributes } from "../RoutingAttributes";
import each from 'jest-each';

const origin = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [0, 0],
    },
    properties: {},
};
const destination = {
    type: 'Feature' as const,
    geometry: {
        type: 'Point' as const,
        coordinates: [1, 1],
    },
    properties: {},
};

describe('createRoutingAttributes', () => {
    each([
        [
            'a few params', 
            {
                routingName: 'fastest',
                routingModes: ['transit' as const],
                engine: 'engine',
                timeSecondsSinceMidnight: 3600,
                timeType: 'departure' as const,
                originGeojson: origin,
                destinationGeojson: destination,
                withAlternatives: true,
            }, {
                routingName: 'fastest',
                routingModes: ['transit'],
                engine: 'engine',
                timeSecondsSinceMidnight: 3600,
                timeType: 'departure',
                originGeojson: origin,
                destinationGeojson: destination,
                withAlternatives: true,
            }
        ], [
            'minimal params', 
            {
                routingModes: ['transit' as const],
                originGeojson: origin,
                destinationGeojson: destination
            }, {
                routingModes: ['transit'],
                engine: undefined,
                timeSecondsSinceMidnight: 0,
                timeType: 'departure',
                originGeojson: origin,
                destinationGeojson: destination,
                withAlternatives: false
            }
        ], [
            'all params', 
            {
                routingName: 'fastest',
                routingModes: ['transit' as const],
                engine: 'engine',
                timeSecondsSinceMidnight: 10000,
                timeType: 'arrival' as const,
                originGeojson: origin,
                destinationGeojson: destination,
                waypoints: [origin, destination],
                withAlternatives: true,
                minWaitingTimeSeconds: 100,
                maxTransferTravelTimeSeconds: 200,
                maxAccessEgressTravelTimeSeconds: 300,
                maxWalkingOnlyTravelTimeSeconds: 400,
                maxFirstWaitingTimeSeconds: 500,
                maxTotalTravelTimeSeconds: 600,
                walkingSpeedMps: 3.5,
                walkingSpeedFactor: 0.3
            }, {
                routingName: 'fastest',
                routingModes: ['transit'],
                engine: 'engine',
                timeSecondsSinceMidnight: 10000,
                timeType: 'arrival',
                originGeojson: origin,
                destinationGeojson: destination,
                waypoints: [origin, destination],
                withAlternatives: true,
                minWaitingTimeSeconds: 100,
                maxTransferTravelTimeSeconds: 200,
                maxAccessEgressTravelTimeSeconds: 300,
                maxWalkingOnlyTravelTimeSeconds: 400,
                maxFirstWaitingTimeSeconds: 500,
                maxTotalTravelTimeSeconds: 600,
                walkingSpeedMps: 3.5,
                walkingSpeedFactor: 0.3
            }
        ]
    ]).test('valid parameters: %s', (_title, partialAttributes: any, expectedAttributes) => {
        const result = validateAndCreateTripRoutingAttributes(partialAttributes);
        expect(result).toEqual(expectedAttributes);
    });

    each([
        [
            'origin', {
                routingModes: ['transit'],
                destinationGeojson: destination
            },
        ], [
            'destination', {
                routingModes: ['transit'],
                originGeojson: origin,
            },
        ], [
            'routingModes', {
                originGeojson: origin,
                destinationGeojson: destination
            }
        ], [
            'all', { }
        ],
        // Add more invalid attribute combinations here
    ]).test('Missing mandatory parameter: %s', (_title, partialAttributes: any) => {
        expect(() => validateAndCreateTripRoutingAttributes(partialAttributes)).toThrow(Error);
    });

    each([
        [
            'origin, destination',
            {
                originGeojson: { type: 'Point', coordinates: [0, 0]},
                destinationGeojson: 'Not a geojson'
            },
        ],
        [
            'engines',
            {
                engine: 3
            },
        ],
        [
            'transit attributes',
            {
                minWaitingTimeSeconds: '300',
                maxTransferTravelTimeSeconds: false,
                maxAccessEgressTravelTimeSeconds: { value: 300 },
                maxWalkingOnlyTravelTimeSeconds: [ 0, 30],
                maxFirstWaitingTimeSeconds: 50.6,
                maxTotalTravelTimeSeconds: -100,
                walkingSpeedMps: '0.30',
                walkingSpeedFactor: { factor: 0.3},
                scenarioId: 1
            },
        ], [
            'alternatives, waypoints',
            {
                withAlternatives: 'true',
                waypoints: [9, 3]
            },
        ],
        // Add more invalid attribute combinations here
    ]).test('Invalid parameter: %s', (_title, erroneousAttributes: any) => {
        const partialAttributes = Object.assign({
            routingName: 'name',
            routingModes: ['transit'],
            engine: 'engine',
            timeSecondsSinceMidnight: 3600,
            timeType: 'departure',
            originGeojson: origin,
            destinationGeojson: destination,
            withAlternatives: true,
        }, erroneousAttributes);
        let error: Error | null = null;
        try {
            validateAndCreateTripRoutingAttributes(partialAttributes);
        } catch (e) {
            error = e as Error;
        }
        expect(error).toBeDefined();
        Object.keys(erroneousAttributes).forEach((key) => expect((error as Error).message).toContain(key));
    });
})
