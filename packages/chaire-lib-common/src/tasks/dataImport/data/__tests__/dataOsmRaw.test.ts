/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { DataFileOsmRaw, DataOsmRaw } from '../dataOsmRaw';
import each from 'jest-each';

const osmString = `{
  "version": 0.6,
  "generator": "Overpass API 0.7.56.7 b85c4387",
  "osm3s": {
    "timestamp_osm_base": "2020-10-28T14:18:02Z",
    "copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL."
  },
  "elements": [
    {
      "type": "node",
      "id": 19727383,
      "lat": 45.3528233,
      "lon": -73.9505808,
      "timestamp": "2020-10-21T16:30:08Z",
      "version": 8,
      "changeset": 92844653,
      "user": "ChaireMobiliteKaligrafy",
      "uid": 549389,
      "tags": {
        "entrance":"shop;home"
      }
    },
    {
      "type": "node",
      "id": 19727407,
      "lat": 45.3557913,
      "lon": -73.9399907,
      "timestamp": "2020-10-21T16:05:16Z",
      "version": 8,
      "changeset": 92843644,
      "user": "ChaireMobiliteKaligrafy",
      "uid": 549389
    },
    {
      "type": "way",
      "id": 132769335,
      "timestamp": "2020-04-01T21:06:44Z",
      "version": 3,
      "changeset": 82944453,
      "user": "ChaireMobiliteKaligrafy",
      "uid": 549389,
      "nodes": [
        1460602872,
        1460602930,
        1460602921,
        1460602943,
        1460602905,
        1460602890,
        7202332429,
        1460602885,
        1460602872
      ],
      "tags": {
        "addr:housenumber": "387",
        "addr:postcode": "J7V 4X3",
        "addr:street": "Grand Boulevard",
        "building": "commercial;detached",
        "building:flats": "4",
        "building:floor_area": "1555"
      }
    },
    {
      "type": "way",
      "id": 132769336,
      "timestamp": "2020-02-11T01:26:24Z",
      "version": 2,
      "changeset": 80820057,
      "user": "ChaireMobiliteKaligrafy",
      "uid": 549389,
      "nodes": [
        1460602939,
        1460602892,
        7202234777,
        1460602924,
        1460602887,
        1460602883,
        1460602910,
        1460602948,
        7202234773,
        1460602939
      ],
      "tags": {
        "building": "commercial"
      }
    }
  ]}`
const dummyFileManager = { readFileAbsolute: () => osmString}

const dataFile = new DataFileOsmRaw('dummyFile', dummyFileManager);
const dataString = new DataOsmRaw(JSON.parse(osmString));

each([
    ['string', dataString],
    ['file', dataFile]
]).describe('Testing valid data source %s', (_name, dataSource) => {
    test('Test data query', async () => {

        // Test one property
        let queryResults = dataSource.query({type: "node"});
        expect(queryResults.length).toEqual(2);
        // Test with size
        queryResults = dataSource.query({type: "node"}, 1);
        expect(queryResults.length).toEqual(1);
        // Test 2 properties together
        queryResults = dataSource.query({type: "node", lat: 45.3528233});
        expect(queryResults.length).toEqual(1);
        // Test empty query, returns all
        queryResults = dataSource.query({});
        expect(queryResults.length).toEqual(4);
        // Test query with no known key, returns nothing
        queryResults = dataSource.query({notAKey: undefined});
        expect(queryResults.length).toEqual(0);
        // Test the tags key
        queryResults = dataSource.query({tags: {building: 'commercial'}});
        expect(queryResults.length).toEqual(2);
        // Test the presence of a field (undefined value)
        queryResults = dataSource.query({lon: undefined});
        expect(queryResults.length).toEqual(2);
        queryResults = dataSource.query({tags: {'building:flats': undefined}});
        expect(queryResults.length).toEqual(1);
        queryResults = dataSource.query({tags: {'building:floor_area': undefined}});
        expect(queryResults.length).toEqual(1);
        // Test queries with fields with multiple OR'ed values
        queryResults = dataSource.query({type: ["node", "way"]});
        expect(queryResults.length).toEqual(4);
        queryResults = dataSource.query({nodes: [1460602887, 7202234777, 1460602872]});
        expect(queryResults.length).toEqual(2);
        // Query on an arrayed tag on node
        queryResults = dataSource.query({tags: {'entrance': 'shop'}})
        expect(queryResults.length).toEqual(1);
        queryResults = dataSource.query({tags: {'entrance': 'home'}})
        expect(queryResults.length).toEqual(1);
        // Query on an arrayed tag on building
        queryResults = dataSource.query({tags: {'building': 'detached'}})
        expect(queryResults.length).toEqual(1);
    });

    test('Test data query Or', async () => {

      // Test one property
      let queryResults = dataSource.queryOr([{type: "node"}, {type: "way"}]);
      expect(queryResults.length).toEqual(4);
      // Test with size
      queryResults = dataSource.queryOr([{type: "node"}, {type: "way"}], 2);
      expect(queryResults.length).toEqual(2);
      // Test 2 properties together
      queryResults = dataSource.queryOr([{type: "node", lat: 45.3528233}, {type: "way"}]);
      expect(queryResults.length).toEqual(3);
      // Test empty query, returns all
      queryResults = dataSource.queryOr([]);
      expect(queryResults.length).toEqual(4);
    });

    test('Test find', async () => {

      // Test one property
      let queryResult = dataSource.find({type: "node"});
      expect(queryResult).toBeTruthy();
      expect((queryResult as any).id).toEqual(19727383);
      // Not found
      queryResult = dataSource.find({uid: 1});
      expect(queryResult).toEqual(undefined);
    });
});

test('Empty input string', async () => {
    const invalidJson = {};
    const dataSource = new DataOsmRaw(invalidJson as any);
    // Test one property
    const queryResult = dataSource.find({type: "node"});
    expect(queryResult).toBeFalsy();
});

test('Input string with no elements', async () => {
    const invalidJson = {something: 'abc'};
    const dataSource = new DataOsmRaw(invalidJson as any);
    // Test one property
    const queryResult = dataSource.find({type: "node"});
    expect(queryResult).toBeFalsy();
});
