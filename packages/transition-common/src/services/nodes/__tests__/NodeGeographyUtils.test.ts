/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import { EventEmitter } from 'events';
import { distance as turfDistance, point as turfPoint } from '@turf/turf';

import * as Status from 'chaire-lib-common/lib/utils/Status';
import Preferences from 'chaire-lib-common/lib/config/Preferences';

import Node from '../Node';
import { PlaceCollection } from '../../places/PlaceCollection';
import { proposeNames, placesInWalkingTravelTimeRadiusSeconds } from '../NodeGeographyUtils';

// new version of turf 7 for line intersect will not return intersection for lines just touching at the end, so we need to use a small offset
// TODO: add a new version to accept touching lines, since it can occur in real life
const street1 = {
    type: 'Feature',
    properties: { name: 'Street 1' },
    geometry: { type: 'LineString', coordinates: [[-73.9980, 45.0000], [-73.9970, 45.0010]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const street2 = {
    type: 'Feature',
    properties: { name: 'Street 2' },
    geometry: { type: 'LineString', coordinates: [[-73.9970, 45.0010], [-73.9960, 45.0020]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const street1b = {
    type: 'Feature',
    properties: { name: 'Street 1' },
    geometry: { type: 'LineString', coordinates: [[-73.9980, 45.0000], [-73.9969, 45.0011]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const street2b = {
    type: 'Feature',
    properties: { name: 'Street 2' },
    geometry: { type: 'LineString', coordinates: [[-73.9970, 45.0010], [-73.9960, 45.0020]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const street3 = {
    type: 'Feature',
    properties: { name: 'Street 3' },
    geometry: { type: 'LineString', coordinates: [[-73.9980, 45.0000], [-73.9965, 45.0015]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const street4 = {
    type: 'Feature',
    properties: { name: 'Street 4' },
    geometry: { type: 'LineString', coordinates: [[-73.9965, 45.0000], [-73.9950, 45.0015]] },
} as GeoJSON.Feature<GeoJSON.LineString>;

const mockSocket = new EventEmitter();
mockSocket.on('osm.streetsAroundPoint', (nodeGeojson, radiusAroundMeters, callback) => {
    if (nodeGeojson.properties.code === '123') {
        //lines are touching at extremities, but not continue further
        callback(Status.createOk([
            street1,
            street2,
        ] as GeoJSON.Feature[]));
    } else if (nodeGeojson.properties.code === '123b') {
        // lines are intersecting but are not touching at extremities
        callback(Status.createOk([
            street1b,
            street2b,
        ] as GeoJSON.Feature[]));
    } else if (nodeGeojson.properties.code === '234') { // no intersection
        callback(Status.createOk([
            street3,
            street4,
        ] as GeoJSON.Feature[]));
    } else {
        callback({ status: 'error', error: 'Invalid radius' });
    }
});

describe('proposeNames', () => {
    test('should return intersection names within the specified radius (just touching at extremities), ordered by distance', async () => {
        const node = new Node({
            id: uuidV4(),
            code: '123',
            geography: { type: 'Point' as const, coordinates: [-73.9975, 45.0005] },
        }, true);
        const maxRadiusMeters = 100;

        const result = await proposeNames(mockSocket, node, maxRadiusMeters);

        const distance1 = turfDistance(turfPoint([-73.9975, 45.0005]), turfPoint([-73.9970, 45.0010]));
        const distance2 = turfDistance(turfPoint([-73.9975, 45.0005]), turfPoint([-73.9980, 45.0000]));

        expect(result).toEqual(
            distance1 < distance2 ? ['Street 1 / Street 2', 'Street 2 / Street 1'] : ['Street 2 / Street 1', 'Street 1 / Street 2']
        );
    });

    test('should return intersection names within the specified radius (intersecting), ordered by distance', async () => {
        const node = new Node({
            id: uuidV4(),
            code: '123b',
            geography: { type: 'Point' as const, coordinates: [-73.9975, 45.0005] },
        }, true);
        const maxRadiusMeters = 100;

        const result = await proposeNames(mockSocket, node, maxRadiusMeters);

        const distance1 = turfDistance(turfPoint([-73.9975, 45.0005]), turfPoint([-73.9970, 45.0010]));
        const distance2 = turfDistance(turfPoint([-73.9975, 45.0005]), turfPoint([-73.9980, 45.0000]));

        expect(result).toEqual(
            distance1 < distance2 ? ['Street 1 / Street 2', 'Street 2 / Street 1'] : ['Street 2 / Street 1', 'Street 1 / Street 2']
        );
    });

    test('should return street names if no intersections are found', async () => {
        const node = new Node({
            id: uuidV4(),
            code: '234',
            geography: { type: 'Point' as const, coordinates: [-73.9965, 45.0005] },
        }, true);
        const maxRadiusMeters = 200;

        const result = await proposeNames(mockSocket, node, maxRadiusMeters);

        expect(result).toEqual(['Street 3', 'Street 4']);
    });

    test('should return undefined if an error occurs', async () => {
        const node = new Node({
            id: uuidV4(),
            geography: { type: 'Point' as const, coordinates: [-73.9975, 45.0005] },
        }, true);
        const maxRadiusMeters = 300;

        const result = await proposeNames(mockSocket, node, maxRadiusMeters);

        expect(result).toBeUndefined();
    });

});

describe('placesInWalkingTravelTimeRadiusSeconds', () => {
    const makePlace = (integerId: number, latitudeOffset: number, category: string, categoryDetailed: string) => ({
        type: 'Feature' as const,
        id: integerId,
        geometry: { type: 'Point' as const, coordinates: [-73.6, 45.5 + latitudeOffset] },
        properties: { id: uuidV4(), integer_id: integerId, data: { category, category_detailed: categoryDetailed } }
    });

    afterEach(() => {
        Preferences.set('transit.nodes.useBirdDistanceForTransferableNodes', false);
    });

    test('should group the places in the walking radius by travel time, with bird distances', async () => {
        Preferences.set('transit.nodes.useBirdDistanceForTransferableNodes', true);
        const node = new Node({ id: uuidV4(), geography: { type: 'Point', coordinates: [-73.6, 45.5] } }, false);
        // Places about 100 m, 400 m and 1 km north of the node. At the default walking speed of 5 km/h, they are
        // 2 minutes, 5 minutes and 12 minutes away, the last one being outside the 10 minutes radius
        const placeCollection = new PlaceCollection(
            [
                makePlace(1, 0.0009, 'education', 'school_primary'),
                makePlace(2, 0.0036, 'leisure', 'leisure_park'),
                makePlace(3, 0.009, 'education', 'school_primary')
            ] as any,
            {}
        );

        const accessiblePlaces = await placesInWalkingTravelTimeRadiusSeconds(node, placeCollection, 600);

        expect(accessiblePlaces.mode).toEqual('walking');
        expect(accessiblePlaces.placesByTravelTimeByCategory.length).toEqual(11);
        accessiblePlaces.placesByTravelTimeByCategory.forEach((placesByCategory, minutes) => {
            expect(placesByCategory).toEqual(minutes === 2 ? { education: [1] } : minutes === 5 ? { leisure: [2] } : {});
        });
        accessiblePlaces.placesByTravelTimeByDetailedCategory.forEach((placesByCategory, minutes) => {
            expect(placesByCategory).toEqual(
                minutes === 2 ? { school_primary: [1] } : minutes === 5 ? { leisure_park: [2] } : {}
            );
        });
    });
});
