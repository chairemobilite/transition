/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { EventEmitter } from 'events';
import * as Status from 'chaire-lib-common/lib/utils/Status';
import osmRoutes from '../osm.socketRoutes';
import { getStreetsAroundPoint } from '../../services/osm/OsmGetStreetsAroundPoint';

const socketStub = new EventEmitter();
osmRoutes(socketStub);
jest.mock('../../services/osm/OsmGetStreetsAroundPoint', () => {
    return {
        getStreetsAroundPoint: jest.fn(),
    };
});
const mockedGetStreetsAroundPoint = getStreetsAroundPoint as jest.MockedFunction<typeof getStreetsAroundPoint>;

describe('OSM: get streets around point', () => {

    const aroundPoint = {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'Point' as const, coordinates: [-73.6, 45.5] }
    };

    test('Get streets around point correctly', (done) => {
        mockedGetStreetsAroundPoint.mockResolvedValueOnce({ status: 'ok', result: [] });
        socketStub.emit('osm.streetsAroundPoint', aroundPoint, 100, (status) => {
            expect(Status.isStatusOk(status));
            expect(Status.unwrap(status)).toEqual([]);
            expect(mockedGetStreetsAroundPoint).toHaveBeenLastCalledWith(aroundPoint, 100);
            done();
        });
    });

    test('Get streets around point with error', (done) => {
        mockedGetStreetsAroundPoint.mockResolvedValueOnce({ status: 'error', error: 'Error while getting streets around point' });
        socketStub.emit('osm.streetsAroundPoint', aroundPoint, 100, (status) => {
            expect(Status.isStatusError(status));
            expect(mockedGetStreetsAroundPoint).toHaveBeenLastCalledWith(aroundPoint, 100);
            done();
        });
    });

});
