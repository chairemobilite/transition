/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { findOverlappingPlaces } from '../FindOverlappingFeatures';
import { PlaceAttributes } from '../../places';
import GeoJSON from 'geojson';

const mainFeature: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: {
    type: "Polygon",
    coordinates: [[
            [ -74, 45 ],
            [ -74, 46 ],
            [ -73, 46 ],
            [ -73, 45 ],
            [ -74, 45 ]
        ]]
    }
}

const createPlace = (coord: [number, number]): PlaceAttributes => {
    return {
        id: "uuid",
        data_source_id: "dataSource",
        internal_id : "internalId",
        shortname: "shortname",
        name: "name",
        description: "description",
        data: {},
        geography: {type: "Point", coordinates: coord}
    };
};

test('Test overlapping places', () => {
    const nonOverlappingPoints: PlaceAttributes[] = [createPlace([-87, 25]),
        createPlace([45, 30])];
    expect(findOverlappingPlaces(mainFeature, nonOverlappingPoints).length).toEqual(0);
    expect(findOverlappingPlaces(mainFeature, nonOverlappingPoints, {not : false}).length).toEqual(0);
    expect(findOverlappingPlaces(mainFeature, nonOverlappingPoints, {not : true}).length).toEqual(2);
    const someOverlappingPoints: PlaceAttributes[] = [createPlace([-73.23, 45.4]),
        createPlace([-73, 45]),
        createPlace([45, 30])];
    expect(findOverlappingPlaces(mainFeature, someOverlappingPoints).length).toEqual(2);
    expect(findOverlappingPlaces(mainFeature, someOverlappingPoints, {not : false}).length).toEqual(2);
    expect(findOverlappingPlaces(mainFeature, someOverlappingPoints, {not : true}).length).toEqual(1);

})
