/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { TransitBatchRoutingCalculator } from '../TransitBatchRoutingCalculator';
import { TransitOdDemandFromCsv } from '../../transitDemand/TransitOdDemandFromCsv';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import { TrRoutingConstants } from 'chaire-lib-common/lib/api/TrRouting';

const socketMock = new EventEmitter();
const defaultResponse = {
    calculationName: 'name',
    detailed: false,
    completed: false,
    warnings: [],
    errors: []
};
const batchRouteSocketMock = jest.fn().mockImplementation((parameters, transitRoutingAttributes, callback) => callback(Status.createOk(defaultResponse)));

socketMock.on(TrRoutingConstants.BATCH_ROUTE, batchRouteSocketMock);
serviceLocator.addService('socketEventManager', socketMock);

beforeEach(() => {
    batchRouteSocketMock.mockClear();
})

describe('Test Calculate', () => {

    const defaultDemandAttributes = {
        type: 'csv' as const,
        fileAndMapping: {
            csvFile: { location: 'upload' as const, filename: 'trips.csv', uploadFilename: 'uploadedTrips.csv' },
            fieldMappings: {
                projection: 'projection',
                timeType: 'arrival' as const,
                timeFormat: 'HH:MM',
                time: 'time',
                id: 'id',
                originLon: 'xorig',
                originLat: 'yorig',
                destinationLon: 'xdest',
                destinationLat: 'ydest'
            }
        },
        csvFields: ['id', 'xorig', 'yorig', 'xdest', 'ydest', 'time']
    };
   
    const defaultDemand = new TransitOdDemandFromCsv(defaultDemandAttributes);
    const defaultQueryParams = {
        routingModes: [ 'walking' as const ],
        minWaitingTimeSeconds: 180,
        scenarioId: 'scenarioId',
        detailed:false,
        withGeometries: false,
        engines: [],
        withAlternatives: false,
        // TODO Remove these from this object once trRouting is parallel
        cpuCount: 1,
        maxCpuCount: 2,
    };

    test('Calculate with valid values', async () => {
        const result = await TransitBatchRoutingCalculator.calculate(defaultDemand, defaultQueryParams);
        expect(result).toEqual(defaultResponse);

        expect(batchRouteSocketMock).toHaveBeenCalledTimes(1);
        expect(batchRouteSocketMock).toHaveBeenCalledWith( defaultDemandAttributes, defaultQueryParams, expect.anything())
    });

    test('Calculate with valid values, but server error', async () => {
        batchRouteSocketMock.mockImplementationOnce((_parameters, _transitRoutingAttributes, callback) => callback(Status.createError('arbitrary error')))
        await expect(async () => await TransitBatchRoutingCalculator.calculate(defaultDemand, defaultQueryParams))
            .rejects
            .toThrowError('cannot calculate transit batch route with trRouting: arbitrary error');

        expect(batchRouteSocketMock).toHaveBeenCalledTimes(1);
        expect(batchRouteSocketMock).toHaveBeenCalledWith( defaultDemandAttributes, defaultQueryParams, expect.anything())
    });

    test('Calculate with invalid demand parameters', async () => {
        // File set but no other attribute
        const invalidDemandConfiguration = {
            type: 'csv' as const,
            fileAndMapping: {
                csvFile: { location: 'upload' as const, filename: 'trips.csv', uploadFilename: 'uploadedTrips.csv' },
                fieldMappings: { }
            },
            csvFields: []
        }
        const invalidDemand = new TransitOdDemandFromCsv(invalidDemandConfiguration as any);
        await expect(async () => await TransitBatchRoutingCalculator.calculate(invalidDemand, defaultQueryParams))
            .rejects
            .toThrow('cannot calculate transit batch route: the CSV file data is invalid');

        expect(batchRouteSocketMock).not.toHaveBeenCalled();
    });

    test('Calculate with invalid query values', async () => {
        // No scenario ID
        const invalidQueryParams = {
            minWaitingTimeSeconds: 180,
        }
        await expect(async () => await TransitBatchRoutingCalculator.calculate(defaultDemand, invalidQueryParams as any))
            .rejects
            .toThrowError('cannot calculate transit batch route: the routing parameters are invalid');

        expect(batchRouteSocketMock).not.toHaveBeenCalled();
    });

});
