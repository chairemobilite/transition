/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';

import routeOdTrip from '../TrRoutingOdTrip';
import { simplePathResult,  alternativesResult, walkingRouteResult, cyclingRouteResult } from './TrRoutingResultStub';
import { TransitRouting, TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { BaseOdTrip } from 'transition-common/lib/services/odTrip/BaseOdTrip';
import { TransitRoutingResult } from 'transition-common/lib/services/transitRouting/TransitRoutingResult';
import { UnimodalRouteCalculationResult } from 'transition-common/lib/services/transitRouting/RouteCalculatorResult';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { ErrorCodes } from 'chaire-lib-common/lib/services/trRouting/TrRoutingService';
import { routeToUserObject } from 'chaire-lib-common/src/services/trRouting/TrRoutingResultConversion';

const calculateMock = jest.fn();

jest.mock('transition-common/lib/services/transitRouting/TransitRoutingCalculator', () => {
    return {
        TransitRoutingCalculator: {
            calculate: jest.fn().mockImplementation(async (
                routing: TransitRouting,
                updatePreferences = false,
                options: { isCancelled?: () => void; [key: string]: any } = {}
            ) => calculateMock(routing, updatePreferences, options))
        }
    }
});

const transitRoutingAttributes: TransitRoutingAttributes = {
    id: 'arbitrary',
    data: {},
    savedForBatch: [],
}

beforeEach(() => {
    calculateMock.mockClear();
});

const origin = simplePathResult.routes[0].originDestination[0];
const destination = simplePathResult.routes[0].originDestination[1];
const odTrip = new BaseOdTrip({
    origin_geography: origin.geometry,
    destination_geography: destination.geometry,
    internal_id: 'test',
    timeOfTrip: 28000,
    timeType: 'departure'
}, false);

describe('Various scenario of trip calculation', () => {

    test('One mode', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);
        expect(result).toEqual({
            uuid: odTrip.attributes.id,
            internalId: odTrip.attributes.internal_id,
            origin: odTrip.attributes.origin_geography,
            destination: odTrip.attributes.destination_geography,
            results: resultByMode
        });
        expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({
            _attributes: expect.objectContaining({
                originGeojson: origin,
                destinationGeojson: destination
            })
        }), false, expect.anything());
    });

    test('Multiple modes', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: simplePathResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(simplePathResult.routes[0]);

        expect(result).toEqual({
            uuid: odTrip.attributes.id,
            internalId: odTrip.attributes.internal_id,
            origin: odTrip.attributes.origin_geography,
            destination: odTrip.attributes.destination_geography,
            results: resultByMode
        });
    });

    test('With alternatives', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit:
            new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: alternativesResult.routes,
                maxWalkingTime: 300
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            reverseOD: false,
        });
        const expectedUserResult = routeToUserObject(alternativesResult.routes[0]);
        expect(result).toEqual({
            uuid: odTrip.attributes.id,
            internalId: odTrip.attributes.internal_id,
            origin: odTrip.attributes.origin_geography,
            destination: odTrip.attributes.destination_geography,
            results: resultByMode
        });
       
    });

    test('No routing found', async () => {
        // Prepare test data
        const routingAttributes = _cloneDeep(transitRoutingAttributes);
        routingAttributes.routingModes = ['transit', 'walking', 'cycling'];
        const routing = new TransitRouting(routingAttributes);
        const resultByMode = { transit: new TransitRoutingResult({
                origin: origin,
                destination: destination,
                paths: [],
                maxWalkingTime: 300,
                error: new TrError(
                    `cannot calculate transit route with trRouting: no_routing_found`,
                    ErrorCodes.NoRoutingFound,
                    'transit:transitRouting:errors:NoResultFound'
                ).export()
            }),
            walking: new UnimodalRouteCalculationResult({
                routingMode: 'walking',
                origin: origin,
                destination: destination,
                paths: walkingRouteResult.routes
            }),
            cycling: new UnimodalRouteCalculationResult({
                routingMode: 'cycling',
                origin: origin,
                destination: destination,
                paths: cyclingRouteResult.routes
            })
        };
        calculateMock.mockResolvedValue(resultByMode);

        const result = await routeOdTrip(odTrip, {
            routing,
            odTripIndex: 0,
            odTripsCount: 1,
            reverseOD: false,
        });
        expect(result).toEqual({
            uuid: odTrip.attributes.id,
            internalId: odTrip.attributes.internal_id,
            origin: odTrip.attributes.origin_geography,
            destination: odTrip.attributes.destination_geography,
            results: resultByMode
        });

    });
});

test('Test reverse OD', async () => {
    // The returned data has no relation with the query, it is the same as before, nothing to test here, just that the parameters are right
    const routingAttributes = _cloneDeep(transitRoutingAttributes);
    routingAttributes.routingModes = ['transit'];
    const routing = new TransitRouting(routingAttributes);
    const resultByMode = { transit:
        new TransitRoutingResult({
            origin: origin,
            destination: destination,
            paths: simplePathResult.routes,
            maxWalkingTime: 300
        })
    };
    calculateMock.mockResolvedValue(resultByMode);

    const result = await routeOdTrip(odTrip, {
        routing,
        odTripIndex: 0,
        odTripsCount: 1,
        reverseOD: true,
    });
    expect(calculateMock).toHaveBeenCalledWith(expect.objectContaining({
        _attributes: expect.objectContaining({
            originGeojson: destination,
            destinationGeojson: origin
        })
    }), false, expect.anything());
});
