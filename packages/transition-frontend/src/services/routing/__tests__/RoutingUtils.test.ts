/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import _cloneDeep from 'lodash/cloneDeep';
import { EventEmitter } from 'events';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';

import { calculateRouting } from '../RoutingUtils';
import TransitRouting, { TransitRoutingAttributes } from 'transition-common/lib/services/transitRouting/TransitRouting';
import { TestUtils } from 'chaire-lib-common/lib/test';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { RoutingResultsByMode, TransitRoutingQueryAttributes } from 'chaire-lib-common/lib/services/routing/types';

// Mock functions that test can use to simulate the calculation. The mocked
// result specified in the test will be sent back to the socket route callback,
// as the calulation response from the server.
const calculateMock = jest.fn() as jest.MockedFunction<(arg: TransitRoutingQueryAttributes) => Status.Status<RoutingResultsByMode>>;
const socketMock = new EventEmitter();
const calculateServerMock = jest.fn().mockImplementation((queryAttributes, callback) => callback(calculateMock(queryAttributes)));

socketMock.on('routing.calculate', calculateServerMock);
serviceLocator.addService('socketEventManager', socketMock);
jest.spyOn(TransitRouting.prototype, 'updateRoutingPrefs').mockImplementation(() => {});

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
        calculateMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateRouting(routing);

        expect(routingResults).toEqual(results);
        expect(calculateMock).toHaveBeenCalledWith(
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
        calculateMock.mockReturnValueOnce(Status.createOk(results));

        const routingResults = await calculateRouting(routing);

        expect(routingResults).toEqual({
            transit: results.transit
        });
        expect(calculateMock).toHaveBeenCalledWith(
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
        calculateMock.mockReturnValueOnce(Status.createOk(results));
        const routingResults = await calculateRouting(routing, true);
        
        expect(routingResults).toEqual(results);
        expect(calculateMock).toHaveBeenCalledWith(
            routing.toTripRoutingQueryAttributes()
        );
        expect(routing.updateRoutingPrefs).toHaveBeenCalledTimes(1);
    });

    it('should reject with error if routing calculation fails', async () => {
        const attributes: TransitRoutingAttributes = _cloneDeep(defaultAttributes);
        attributes.routingModes = ['cycling'];
        const routing = new TransitRouting(attributes);
        const error = 'Error';
        calculateMock.mockReturnValueOnce(Status.createError(error));
        await expect(calculateRouting(routing, false)).rejects.toEqual(error);
    }); 
});
