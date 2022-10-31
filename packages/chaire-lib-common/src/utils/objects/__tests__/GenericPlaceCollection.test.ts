/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash.clonedeep';

import { TestUtils, RoutingServiceManagerMock } from '../../../test';
import { GenericPlace, GenericPlaceAttributes } from '../GenericPlace';
import GenericPlaceCollection from '../GenericPlaceCollection';
import CollectionManager from '../CollectionManager';
import EventManager from '../../../services/events/EventManager';

jest.mock('../../../services/routing/RoutingServiceManager', () => RoutingServiceManagerMock.routingServiceManagerMock);

const collectionManager = new CollectionManager(new EventManager());
const point1 = TestUtils.makePoint([-73, 45]);
const point2 = TestUtils.makePoint([-73.00001, 45.000009]);
const point3 = TestUtils.makePoint([-73.0000011, 45.000034]);
const point4 = TestUtils.makePoint([-73.2, 45.2]);
const genericPlace1: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point1.geometry, id: uuidV4(), integer_id: 1 }, false, collectionManager);
const genericPlace2: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point2.geometry, id: uuidV4(), integer_id: 2 }, false, collectionManager);
const genericPlace3: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point3.geometry, id: uuidV4(), integer_id: 3 }, false, collectionManager);
const genericPlace4: GenericPlace<GenericPlaceAttributes> = new GenericPlace({ geography: point4.geometry, id: uuidV4(), integer_id: 4 }, false, collectionManager);

class GenericMapCollectionStub extends GenericPlaceCollection<GenericPlaceAttributes, GenericPlace<GenericPlaceAttributes>> {
    newObject(attribs: any, isNew?: boolean): GenericPlace<GenericPlaceAttributes> {
        return new GenericPlace(attribs.properties, isNew);
    }

}

const mapCollection = new GenericMapCollectionStub([genericPlace1.toGeojson(), genericPlace2.toGeojson(), genericPlace3.toGeojson(), genericPlace4.toGeojson()]);

test('pointsInBirdRadiusMetersAround', () => {
    let features = mapCollection.pointsInBirdRadiusMetersAround(point1.geometry);
    expect(features).not.toBeNull();
    expect((features as any).length).toEqual(3);

    // Far away point, should not be any points
    features = mapCollection.pointsInBirdRadiusMetersAround({type: 'Point', coordinates: [0, 0]});
    expect(features).not.toBeNull();
    expect((features as any).length).toEqual(0);

    // User larger distance
    features = mapCollection.pointsInBirdRadiusMetersAround(point1.geometry, 100000);
    expect(features).not.toBeNull();
    expect((features as any).length).toEqual(4);
});

test('pointsInWalkingTravelTimeRadiusSecondsAround', async () => {
    const mockRouteEngine = RoutingServiceManagerMock.routingServiceManagerMock.getRoutingServiceForEngine('engine').tableFrom;
    const tableFromResults = { query: '', distances: [0, 1200, 900.3], durations: [0, 800, 600] };
    mockRouteEngine.mockResolvedValueOnce(tableFromResults);

    let walkingPoints = await mapCollection.pointsInWalkingTravelTimeRadiusSecondsAround(point1.geometry, 700);
    expect(walkingPoints.length).toEqual(2);
    expect(mockRouteEngine).toHaveBeenCalledTimes(1);
    expect(mockRouteEngine).toHaveBeenCalledWith({mode: 'walking', origin: point1, destinations: [genericPlace1.toGeojson(), genericPlace2.toGeojson(), genericPlace3.toGeojson()]});
    expect(walkingPoints).toEqual([
        { id: genericPlace1.getAttributes().id, walkingTravelTimesSeconds: Math.ceil(tableFromResults.durations[0]), walkingDistancesMeters: Math.ceil(tableFromResults.distances[0]) },
        { id: genericPlace3.getAttributes().id, walkingTravelTimesSeconds: Math.ceil(tableFromResults.durations[2]), walkingDistancesMeters: Math.ceil(tableFromResults.distances[2]) }
    ]);

});
