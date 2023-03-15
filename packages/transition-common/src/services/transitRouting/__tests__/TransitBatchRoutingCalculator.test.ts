/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import { TransitBatchRoutingCalculator } from '../TransitBatchRoutingCalculator';
import { TransitOdDemandFromCsv } from '../../transitDemand/TransitOdDemandFromCsv';
import { TransitRouting } from '../TransitRouting';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import { TransitRoutingQueryAttributes } from '../../transitRouting/TransitRoutingQueryAttributes';
import CollectionManager from 'chaire-lib-common/lib/utils/objects/CollectionManager';
import DataSourceCollection from '../../dataSource/DataSourceCollection';
import serviceLocator from 'chaire-lib-common/lib/utils/ServiceLocator';
import DataSource from '../../dataSource/DataSource';
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
        calculationName: 'test',
        projection: 'projection',
        csvFile: 'filename',
        timeAttributeDepartureOrArrival: 'arrival' as const,
        timeFormat: 'HH:MM',
        timeAttribute: 'time',
        withGeometries: false,
        detailed: false,
        // TODO Remove these from this object once trRouting is parallel
        cpuCount: 1,
        maxCpuCount: 2,
        idAttribute: 'id',
        originXAttribute: 'xorig',
        originYAttribute: 'yorig',
        destinationXAttribute: 'xdest',
        destinationYAttribute: 'ydest',
        saveToDb: false as const
    };
    const defaultDemand = new TransitOdDemandFromCsv(defaultDemandAttributes);
    const defaultQueryParams = {
        routingModes: [ 'walking' as const ],
        minWaitingTimeSeconds: 180,
        scenarioId: 'scenarioId'
    };
    const expectedDemand = {
        type: 'csv',
        configuration: {
            calculationName: defaultDemandAttributes.calculationName,
            projection: defaultDemandAttributes.projection,
            detailed: defaultDemandAttributes.detailed,
            idAttribute: defaultDemandAttributes.idAttribute,
            originXAttribute: defaultDemandAttributes.originXAttribute,
            originYAttribute: defaultDemandAttributes.originYAttribute,
            destinationXAttribute: defaultDemandAttributes.destinationXAttribute,
            destinationYAttribute: defaultDemandAttributes.destinationYAttribute,
            timeAttributeDepartureOrArrival: defaultDemandAttributes.timeAttributeDepartureOrArrival,
            timeFormat: defaultDemandAttributes.timeFormat,
            timeAttribute: defaultDemandAttributes.timeAttribute,
            withGeometries: defaultDemandAttributes.withGeometries,
            cpuCount: defaultDemandAttributes.cpuCount,
            saveToDb: defaultDemandAttributes.saveToDb
        }
    }

    test('Calculate with valid values', async () => {
        const result = await TransitBatchRoutingCalculator.calculate(defaultDemand, defaultQueryParams);
        expect(result).toEqual(defaultResponse);

        expect(batchRouteSocketMock).toHaveBeenCalledTimes(1);
        expect(batchRouteSocketMock).toHaveBeenCalledWith(expectedDemand, defaultQueryParams, expect.anything())
    });

    test('Calculate with valid values, but server error', async () => {
        batchRouteSocketMock.mockImplementationOnce((_parameters, _transitRoutingAttributes, callback) => callback(Status.createError('arbitrary error')))
        await expect(async () => await TransitBatchRoutingCalculator.calculate(defaultDemand, defaultQueryParams))
            .rejects
            .toThrowError('cannot calculate transit batch route with trRouting: arbitrary error');

        expect(batchRouteSocketMock).toHaveBeenCalledTimes(1);
        expect(batchRouteSocketMock).toHaveBeenCalledWith(expectedDemand, defaultQueryParams, expect.anything())
    });

    test('Calculate with invalid demand parameters', async () => {
        // File set but no other attribute
        const invalidDemand = new TransitOdDemandFromCsv({ csvFile: 'myfile'});
        await expect(async () => await TransitBatchRoutingCalculator.calculate(invalidDemand, defaultQueryParams))
            .rejects
            .toThrowError('cannot calculate transit batch route: the CSV file data is invalid');

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
