/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import { calculateRouting, calculateAccessibilityMap } from '../RoutingUtils';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TestUtils } from 'chaire-lib-common/lib/test';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { RoutingResultsByMode, TransitRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';
import TransitAccessibilityMapRouting, { AccessibilityMapAttributes } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapRouting';
import { TransitAccessibilityMapWithPolygonResult } from 'transition-common/lib/services/accessibilityMap/TransitAccessibilityMapResult';
import { TransitMapCalculationOptions } from 'transition-common/lib/services/accessibilityMap/types';

// Mock functions that test can use to simulate the calculation. The mocked
// result specified in the test will be sent back to the socket route callback,
// as the calulation response from the server.
const calculateRouteMock = jest.fn() as jest.MockedFunction<(arg: TransitRoutingQueryAttributes) => Status.Status<RoutingResultsByMode>>;
const calculateAccessibilityMapMock = jest.fn() as jest.MockedFunction<(arg: AccessibilityMapAttributes, options: TransitMapCalculationOptions) => Status.Status<TransitAccessibilityMapWithPolygonResult>>;
const socketMock = new EventEmitter();
const calculateServerMock = jest.fn().mockImplementation((queryAttributes, callback) => callback(calculateRouteMock(queryAttributes)));
const calculateAccessibilityMapServerMock = jest.fn().mockImplementation((queryAttributes, options, callback) => callback(calculateAccessibilityMapMock(queryAttributes, options)));

socketMock.on('routing.calculate', calculateServerMock);
socketMock.on('accessibiliyMap.calculateWithPolygons', calculateAccessibilityMapServerMock);
serviceLocator.addService('socketEventManager', socketMock);
jest.spyOn(TransitRouting.prototype, 'updateRoutingPrefs').mockImplementation(() => {});
jest.spyOn(TransitAccessibilityMapRouting.prototype, 'updateRoutingPrefs').mockImplementation(() => {});

describe('calculateRouting', () => {
    const defaultAttributes = {
        id: '000',
        is_frozen: false,
        originGeojson: TestUtils.makePoint([-73.745618, 45.368994]),
        destinationGeojson: TestUtils.makePoint([-73.742861, 45.361682]),
        data: {},
        savedForBatch: []
    };
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate routing and receive correct value when successful', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['cycling', 'driving'];
        const routing = new TransitRouting(attributes);
        const results = {
            cycling: {
                routingMode: 'cycling' as const,
                origin: defaultAttributes.originGeojson,
                destination: defaultAttributes.destinationGeojson,
                paths: []
            },
            driving: {
                routingMode: 'driving' as const,
                origin: defaultAttributes.originGeojson,
                destination: defaultAttributes.destinationGeojson,
                paths: []
            }
        }
        calculateRouteMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateRouting(routing);

        expect(routingResults).toEqual(results);
        expect(calculateRouteMock).toHaveBeenCalledWith(
            routing.toTripRoutingQueryAttributes()
        );
        expect(routing.updateRoutingPrefs).not.toHaveBeenCalled();
    });

    it('should calculate routing and add walking mode if transit specified', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['transit'];
        const routing = new TransitRouting(attributes);
        const results = {
            transit: {
                origin: defaultAttributes.originGeojson,
                destination: defaultAttributes.destinationGeojson,
                paths: []
            },
            walking: {
                routingMode: 'walking' as const,
                origin: defaultAttributes.originGeojson,
                destination: defaultAttributes.destinationGeojson,
                paths: []
            }
        }
        calculateRouteMock.mockReturnValueOnce(Status.createOk(results));

        const routingResults = await calculateRouting(routing);

        expect(routingResults).toEqual({
            transit: results.transit
        });
        expect(calculateRouteMock).toHaveBeenCalledWith(
            {
                ...routing.toTripRoutingQueryAttributes(),
                routingModes: ['transit', 'walking']
            }
        );
        expect(routing.updateRoutingPrefs).not.toHaveBeenCalled();
    });

    it('should calculate routing and cancel', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['transit'];
        const routing = new TransitRouting(attributes);
        const isCancelled = jest.fn().mockReturnValue(true);
        const options = { isCancelled };
        
        await expect(calculateRouting(routing, false, options)).rejects.toEqual('Cancelled');
    });

    it('should calculate routing and save preferences if requested', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['cycling'];
        const routing = new TransitRouting(attributes);
        const results = {
            cycling: {
                routingMode: 'cycling' as const,
                origin: defaultAttributes.originGeojson,
                destination: defaultAttributes.destinationGeojson,
                paths: []
            }
        }
        calculateRouteMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateRouting(routing, true);
        
        expect(routingResults).toEqual(results);
        expect(calculateRouteMock).toHaveBeenCalledWith(
            routing.toTripRoutingQueryAttributes()
        );
        expect(routing.updateRoutingPrefs).toHaveBeenCalledTimes(1);
    });

    it('should reject with error if routing calculation fails', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['cycling'];
        const routing = new TransitRouting(attributes);
        const error = 'Error';
        calculateRouteMock.mockReturnValueOnce(Status.createError(error));
        await expect(calculateRouting(routing, false)).rejects.toEqual(error);
    }); 
});

describe('calculateAccessibilityMap', () => {
    const defaultAttributes = {
        locationGeojson: TestUtils.makePoint([-73, 45]),
        scenarioId: 'abc',
        id: 'abcdef',
        data: {},
        arrivalTimeSecondsSinceMidnight: 25200,
        maxTotalTravelTimeSeconds: 1800,
        minWaitingTimeSeconds: 120,
        maxAccessEgressTravelTimeSeconds: 180,
        maxTransferTravelTimeSeconds: 120,
        deltaSeconds: 180,
        deltaIntervalSeconds: 60
    };
    
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should calculate accessibility and receive correct value when successful', async () => {
        const attributes: AccessibilityMapAttributes = _cloneDeep(defaultAttributes);
        const routing = new TransitAccessibilityMapRouting(attributes);
        const results = {
            polygons: { type: 'FeatureCollection' as const, features: [] },
            strokes: { type: 'FeatureCollection' as const, features: [] },
            resultByNode: undefined
        }
        calculateAccessibilityMapMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateAccessibilityMap(routing);

        expect(routingResults).toEqual(results);
        expect(calculateAccessibilityMapMock).toHaveBeenCalledWith(routing.attributes, {});
        expect(routing.updateRoutingPrefs).not.toHaveBeenCalled();
    });

    it('should calculate routing and cancel', async () => {
        const attributes: AccessibilityMapAttributes = _cloneDeep(defaultAttributes);
        const routing = new TransitAccessibilityMapRouting(attributes);
        const isCancelled = jest.fn().mockReturnValue(true);
        const options = { isCancelled };
        
        await expect(calculateAccessibilityMap(routing, false, options)).rejects.toEqual('Cancelled');
    });

    it('should calculate routing and save preferences if requested', async () => {
        const attributes: AccessibilityMapAttributes = _cloneDeep(defaultAttributes);
        const routing = new TransitAccessibilityMapRouting(attributes);
        const results = {
            polygons: { type: 'FeatureCollection' as const, features: [] },
            strokes: { type: 'FeatureCollection' as const, features: [] },
            resultByNode: undefined
        }
        calculateAccessibilityMapMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateAccessibilityMap(routing, true);
        
        expect(routingResults).toEqual(results);
        expect(calculateAccessibilityMapMock).toHaveBeenCalledWith(routing.attributes, {});
        expect(routing.updateRoutingPrefs).toHaveBeenCalledTimes(1);
    });

    it('should reject with error if routing calculation fails', async () => {
        const attributes: AccessibilityMapAttributes = _cloneDeep(defaultAttributes);
        const routing = new TransitAccessibilityMapRouting(attributes);
        const error = 'Error';
        calculateAccessibilityMapMock.mockReturnValueOnce(Status.createError(error));
        await expect(calculateAccessibilityMap(routing, false)).rejects.toEqual(error);
    }); 
});

