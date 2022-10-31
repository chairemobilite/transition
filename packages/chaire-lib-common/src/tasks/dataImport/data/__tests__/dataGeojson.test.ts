/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataFileGeojson, DataGeojson } from '../dataGeojson';
import each from 'jest-each';

const osmString = `{
    "type": "FeatureCollection",
    "generator": "overpass-ide",
    "copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.",
    "timestamp": "2020-10-28T17:12:02Z",
    "features": [
        {
            "type": "Feature",
            "properties": {
              "@id": "way/771779561",
              "access": "customers",
              "amenity": "something"
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [ -73.9547696, 45.3941156 ],
                  [ -73.9548101, 45.3940757 ],
                  [ -73.9548613, 45.3940332 ],
                  [ -73.9547392, 45.3939749 ],
                  [ -73.9546978, 45.3939553 ],
                  [ -73.954615, 45.39404 ],
                  [ -73.9547696, 45.3941156 ]
                ]
              ]
            },
            "id": "way/771779561"
          },
          {
            "type": "Feature",
            "properties": {
              "@id": "way/771779563",
              "building": "commercial",
              "building:flats": "1",
              "building:floor_area": "1254"
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [ -73.9548646, 45.3939151 ],
                  [ -73.9548543, 45.3939286 ],
                  [ -73.9548495, 45.3939349 ],
                  [ -73.9548197, 45.3939238 ],
                  [ -73.954802, 45.3939472 ],
                  [ -73.9548289, 45.3939572 ],
                  [ -73.9548169, 45.3939731 ],
                  [ -73.9548487, 45.393985 ],
                  [ -73.9548342, 45.3940041 ],
                  [ -73.9548848, 45.394023 ],
                  [ -73.9549441, 45.3939448 ],
                  [ -73.9549051, 45.3939302 ],
                  [ -73.9548892, 45.3939243 ],
                  [ -73.9548646, 45.3939151 ]
                ]
              ]
            },
            "id": "way/771779563"
          },
          {
            "type": "Feature",
            "properties": {
              "@id": "way/771779564",
              "building": "kindergarten"
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [ -73.9551772, 45.3939875 ],
                  [ -73.9550564, 45.3941155 ],
                  [ -73.9552063, 45.3941567 ],
                  [ -73.9552387, 45.3941747 ],
                  [ -73.9552708, 45.3940661 ],
                  [ -73.9551772, 45.3939875 ]
                ]
              ]
            },
            "id": "way/771779564"
          },
          {
            "type": "Feature",
            "properties": {
              "@id": "way/771779565",
              "access": "customers",
              "amenity": "parking"
            },
            "geometry": {
              "type": "Polygon",
              "coordinates": [
                [
                  [ -73.9549849, 45.3941679 ],
                  [ -73.9551753, 45.3942687 ],
                  [ -73.9549849, 45.3941679 ]
                ]
              ]
            },
            "id": "way/771779565"
          }
    ]}`
const dummyFileManager = { readFileAbsolute: () => osmString}

const dataFile = new DataFileGeojson('dummyGeojsonFile', dummyFileManager);
const dataString = new DataGeojson(JSON.parse(osmString));

each([
    ['string', dataString],
    ['file', dataFile]
]).describe('Testing valid data source %s', (_name, dataSource) => {
    test('Test data query', async () => {

        // Test one property
        let queryResults = dataSource.query({access: "customers"});
        expect(queryResults.length).toEqual(2);
        // Test 2 properties together
        queryResults = dataSource.query({access: "customers", amenity: "parking"});
        expect(queryResults.length).toEqual(1);
        // Test empty query, returns all
        queryResults = dataSource.query({});
        expect(queryResults.length).toEqual(4);
        // Test query with no known key, returns nothing
        queryResults = dataSource.query({notAKey: undefined});
        expect(queryResults.length).toEqual(0);
        // Test the id key
        queryResults = dataSource.query({id: "way/771779565"});
        expect(queryResults.length).toEqual(1);
        // Test the presence of a field (undefined value)
        queryResults = dataSource.query({'building': undefined});
        expect(queryResults.length).toEqual(2);
        queryResults = dataSource.query({'building:flats': undefined});
        expect(queryResults.length).toEqual(1);
        queryResults = dataSource.query({'building:floor_area': undefined});
        expect(queryResults.length).toEqual(1);
        // Test queries with fields with multiple OR'ed values
        queryResults = dataSource.query({building: ["commercial", "kindergarten"]});
        expect(queryResults.length).toEqual(2);
        queryResults = dataSource.query({id: ["way/771779565", "way/771779564"]});
        expect(queryResults.length).toEqual(2);
    });

    test('Test data query OR', async () => {

        // Test one property
        let queryResults = dataSource.queryOr([{access: "customers"}]);
        expect(queryResults.length).toEqual(2);
        // Test 2 properties together
        queryResults = dataSource.queryOr([{amenity: "parking"}, {amenity: "something"}]);
        expect(queryResults.length).toEqual(2);
        // Test empty query, returns all
        queryResults = dataSource.queryOr([]);
        expect(queryResults.length).toEqual(4);
        // Test the id key with a building
        queryResults = dataSource.queryOr([{id: "way/771779565"}, {'building': undefined}]);
        expect(queryResults.length).toEqual(3);
    });

    test('Test find', async () => {

        // Test one property
        let queryResult = dataSource.find({"id": "way/771779565"});
        expect(queryResult).toBeTruthy();
        expect((queryResult as any).id).toEqual("way/771779565");
        // Not found
        queryResult = dataSource.find({uid: 1});
        expect(queryResult).toEqual(undefined);
      });
});

test('Test input string feature', async () => {
    const featureGeojson: GeoJSON.GeoJSON = {type: 'Feature' as const, properties: {type: 'node'}, geometry: {
        type: "Polygon",
        coordinates: [
          [
            [ -73.9549849, 45.3941679 ],
            [ -73.9551753, 45.3942687 ],
            [ -73.9549849, 45.3941679 ]
          ]
        ]
    }};
    const dataSource = new DataGeojson(featureGeojson);
    const queryResult = dataSource.query({type: "node"});
    expect(queryResult).toBeTruthy();
    expect(queryResult.length).toEqual(1);
});

test('Test input string polygon', async () => {
    const polygonGeojson: GeoJSON.GeoJSON = {type: "Polygon",
        coordinates: [
          [
            [ -73.9549849, 45.3941679 ],
            [ -73.9551753, 45.3942687 ],
            [ -73.9549849, 45.3941679 ]
          ]
        ]
    };
    const dataSource = new DataGeojson(polygonGeojson);
    const queryResult = dataSource.query({type: "node"});
    expect(queryResult).toBeTruthy();
    expect(queryResult.length).toEqual(0);
});