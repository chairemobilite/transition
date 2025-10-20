/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import OsmOverpassDownloader from '../OsmOverpassDownloader';
import GeoJSON from 'geojson';
import { Writable } from 'node:stream';
import fs from 'fs';

global.fetch = jest.fn();
const mockedFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const overpassQuery = `<osm-script output="OUTPUT" output-config="" timeout="120">
    <union into="_">
        <polygon-query bounds="BOUNDARY"/>
        <recurse from="_" into="_" type="up"/>
    </union>
    <print e="" from="_" geometry="skeleton" ids="yes" limit="" mode="meta" n="" order="id" s="" w=""/>
</osm-script>`;

const geojsonBoundaryPolygon = {
    type: 'Polygon' as const,
    coordinates: [
        [
            [-73.9510, 45.4047],
            [-73.9990, 45.4013],
            [-73.9983, 45.3725],
            [-73.9500, 45.3750],
            [-73.9510, 45.4047]
        ]
    ]
};

const polyboundary = '45.4047 -73.951 45.4013 -73.999 45.3725 -73.9983 45.375 -73.95 45.4047 -73.951';

const jsonData = {
    'version': 0.6,
    'generator': 'Overpass API 0.7.56.8 7d656e78',
    'osm3s': {
        'timestamp_osm_base': '2021-01-11T19:36:03Z',
        'copyright': 'The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.'
    },
    'elements': [
        {
            'type': 'node',
            'id': 123,
            'lat': 45.3941161,
            'lon': -73.9678132,
            'timestamp': '2020-02-08T17:16:30Z',
            'version': 1,
            'user': 'osmUser',
            'changeset': 1,
            'uid': 1,
        },
        {
            'type': 'node',
            'id': 234,
            'lat': 45.3752717,
            'lon': -73.9544677,
            'timestamp': '2020-02-08T17:16:30Z',
            'version': 1,
            'user': 'osmUser',
            'changeset': 1,
            'uid': 1,
        },
        {
            'type': 'node',
            'id': 345,
            'lat': 45.3751139,
            'lon': -73.9545144,
            'timestamp': '2020-02-08T17:16:30Z',
            'version': 1,
            'user': 'osmUser',
            'changeset': 1,
            'uid': 1,
        },
        {
            'type': 'way',
            'id': 456,
            'timestamp': '2020-02-08T17:16:30Z',
            'version': 1,
            'user': 'osmUser',
            'changeset': 1,
            'uid': 1,
            'nodes': [
                123,
                234,
                345
            ],
            'tags': {
                'highway': 'residential',
                'lanes': '2',
                'maxspeed': '30',
                'name': 'Sesame street',
                'sidewalk': 'no'
            }
        },
    ]
};

const geojsonWritten = {
    "type":"FeatureCollection",
    "features":[
        {
            "type":"Feature",
            "id":"node/123",
            "properties":{"id":"node/123","timestamp":"2020-02-08T17:16:30Z","version":1,"user":"osmUser","changeset":1,"uid":1},
            "geometry":{"type":"Point","coordinates":[-73.9678132,45.3941161]}
        },
        {
            "type":"Feature",
            "id":"node/234",
            "properties":{"id":"node/234","timestamp":"2020-02-08T17:16:30Z","version":1,"user":"osmUser","changeset":1,"uid":1},
            "geometry":{"type":"Point","coordinates":[-73.9544677,45.3752717]}
        },
        {
            "type":"Feature",
            "id":"node/345",
            "properties":{"id":"node/345","timestamp":"2020-02-08T17:16:30Z","version":1,"user":"osmUser","changeset":1,"uid":1},
            "geometry":{"type":"Point","coordinates":[-73.9545144,45.3751139]}
        }
]};

const xmlData = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6" generator="Overpass API 0.7.56.8 7d656e78">
<note>The data included in this document is from www.openstreetmap.org. The data is made available under ODbL.</note>
<meta osm_base="2021-01-12T15:25:02Z"/>

  <node id="123" lat="45.3941161" lon="-73.9678132" version="1" timestamp="2020-02-08T17:16:30Z" changeset="1" uid="1" user="osmUser"/>
  <node id="234" lat="45.3752717" lon="-73.9544677" version="1" timestamp="2020-02-08T17:16:30Z" changeset="1" uid="1" user="osmUser"/>
  <node id="345" lat="45.3751139" lon="-73.9545144" version="1" timestamp="2020-02-08T17:16:30Z" changeset="1" uid="1" user="osmUser"/>
  <way id="456" version="1" timestamp="2020-02-08T17:16:30Z" changeset="88092743" uid="11061109" user="osmUser">
    <nd ref="123"/>
    <nd ref="234"/>
    <nd ref="345"/>
    <tag k="highway" v="residential"/>
    <tag k="lanes" v="2"/>
    <tag k="maxspeed" v="30"/>
    <tag k="name" v="Sesame street"/>
    <tag k="sidewalk" v="no"/>
  </way>
</osm>`;

beforeEach(() => {
    jest.resetAllMocks(); // otherwise the mocks will accumulate the calls and haveBeenCalledTimes will not be accurate
});

test('download json data from overpass', async () => {

    const jsonResponse = jest.fn() as jest.MockedFunction<Response['json']>;
    jsonResponse.mockResolvedValue(jsonData);
    const response = Promise.resolve({
        ok: true,
        status: 200,
        json: jsonResponse
    } as Partial<Response> as Response);
    mockedFetch.mockResolvedValue(response);

    const jsonContent = await OsmOverpassDownloader.downloadJson(geojsonBoundaryPolygon, overpassQuery);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('http://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml'
        },
        body: overpassQuery.replace('BOUNDARY', polyboundary).replace('OUTPUT', 'json')
    });
    expect(jsonContent.elements).toBeDefined();
    expect(jsonContent.elements).toEqual(jsonData.elements);

});

test('download geojson data from overpass', async () => {

    const jsonResponse = jest.fn() as jest.MockedFunction<Response['json']>;
    jsonResponse.mockResolvedValue(jsonData);
    const response = Promise.resolve({
        ok: true,
        status: 200,
        json: jsonResponse
    } as Partial<Response> as Response);
    mockedFetch.mockResolvedValue(response);

    const geojsonContent = await OsmOverpassDownloader.downloadGeojson(geojsonBoundaryPolygon, overpassQuery);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('http://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml'
        },
        body: overpassQuery.replace('BOUNDARY', polyboundary).replace('OUTPUT', 'json')
    });
    expect(geojsonContent.type).toBe('FeatureCollection');
    expect(geojsonContent.features).toBeDefined();
    expect(geojsonContent.features.length).toEqual(1);
    expect(geojsonContent.features[0].type).toBe('Feature');
    expect((geojsonContent.features[0] as GeoJSON.Feature).geometry).toBeDefined();

    // Check the feature
    const geometry = (geojsonContent.features[0] as GeoJSON.Feature).geometry;
    expect(geometry.type).toEqual('LineString');
    expect((geometry as GeoJSON.LineString).coordinates.length).toBe(3);

});

test('download xml data from overpass', async () => {

    const xmlResponse = jest.fn() as jest.MockedFunction<Response['text']>;
    xmlResponse.mockResolvedValue(xmlData);
    const response = Promise.resolve({
        ok: true,
        status: 200,
        text: xmlResponse
    } as Partial<Response> as Response);
    mockedFetch.mockResolvedValue(response);

    const xmlContent = await OsmOverpassDownloader.downloadXml(geojsonBoundaryPolygon, overpassQuery);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith('http://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/xml'
        },
        body: overpassQuery.replace('BOUNDARY', polyboundary).replace('OUTPUT', 'xml')
    });
    expect(xmlContent).toEqual(xmlData);

});

test('fetch and write geojson', async () => {
    let mockWriteStream;
    let writtenData = '';
    let streamFilename;
    mockWriteStream = new Writable({
        write(chunk, _encoding, callback) {
          writtenData += chunk.toString();
          callback();
        }
    });

    jest.spyOn(fs, 'createWriteStream').mockImplementation((path) => {
        streamFilename = path;
        return mockWriteStream;
    });

    const streamBody = new ReadableStream({
        start(controller) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify(jsonData)));
            controller.close();
        }
    });
    const response = Promise.resolve({
        ok: true,
        status: 200,
        body: streamBody
    } as Partial<Response> as Response);
    mockedFetch.mockResolvedValue(response);

    const writeIsSuccessful = await OsmOverpassDownloader.fetchAndWriteGeojson('./test.json', geojsonBoundaryPolygon);
    expect(writeIsSuccessful).toBeTruthy();
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(writtenData).toBe(JSON.stringify(geojsonWritten));
    expect(streamFilename).toBe('./test.json');
});
