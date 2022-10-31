/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import OsmOverpassDownloader from '../OsmOverpassDownloader';
import GeoJSON from 'geojson';
import fetchMock from 'jest-fetch-mock'

const overpassQuery = `<osm-script output="OUTPUT" output-config="" timeout="120">
    <union into="_">
        <polygon-query bounds="BOUNDARY"/>
        <recurse from="_" into="_" type="up"/>
    </union>
    <print e="" from="_" geometry="skeleton" ids="yes" limit="" mode="meta" n="" order="id" s="" w=""/>
</osm-script>`;

const geojsonBoundaryPolygon = {
    type: "Polygon" as const,
    coordinates: [
        [
            [ -73.9510, 45.4047 ],
            [ -73.9990, 45.4013 ],
            [ -73.9983, 45.3725 ],
            [ -73.9500, 45.3750 ],
            [ -73.9510, 45.4047 ]
        ]
    ]
};

const polyboundary = '45.4047 -73.951 45.4013 -73.999 45.3725 -73.9983 45.375 -73.95 45.4047 -73.951';

const responseObject = {
    "version": 0.6,
    "generator": "Overpass API 0.7.56.8 7d656e78",
    "osm3s": {
        "timestamp_osm_base": "2021-01-11T19:36:03Z",
        "copyright": "The data included in this document is from www.openstreetmap.org. The data is made available under ODbL."
    },
    "elements": [
        {
            "type": "node",
            "id": 123,
            "lat": 45.3941161,
            "lon": -73.9678132,
            "timestamp": "2020-02-08T17:16:30Z",
            "version": 1,
            "user": "osmUser",
            "changeset": 1,
            "uid": 1,
        },
        {
            "type": "node",
            "id": 234,
            "lat": 45.3752717,
            "lon": -73.9544677,
            "timestamp": "2020-02-08T17:16:30Z",
            "version": 1,
            "user": "osmUser",
            "changeset": 1,
            "uid": 1,
        },
        {
            "type": "node",
            "id": 345,
            "lat": 45.3751139,
            "lon": -73.9545144,
            "timestamp": "2020-02-08T17:16:30Z",
            "version": 1,
            "user": "osmUser",
            "changeset": 1,
            "uid": 1,
        },
        {
            "type": "way",
            "id": 456,
            "timestamp": "2020-02-08T17:16:30Z",
            "version": 1,
            "user": "osmUser",
            "changeset": 1,
            "uid": 1,
            "nodes": [
                123,
                234,
                345
            ],
            "tags": {
                "highway": "residential",
                "lanes": "2",
                "maxspeed": "30",
                "name": "Sesame street",
                "sidewalk": "no"
            }
        },
    ]
};

const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
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
    fetchMock.doMock();
    fetchMock.mockIf(/^https?:\/\/overpass-api\.de\/api\/interpreter.*$/, async req => {
        const body = await req.text();

        // Make sure the polyboundary is in the query
        if (!body.includes(`bounds="${polyboundary}"`)) {
            throw "Invalid poly boundary in request body: " + body;
        }

        // Return proper response depending on output
        if (body.includes('output="xml"')) {
            return xmlResponse;
        } else if (body.includes('output="json"')) {
            return JSON.stringify(responseObject);
        }
        throw "No valid output specified in request body: " + body;
    })
});

test('download json data from overpass', async function() {

    const jsonContent = await OsmOverpassDownloader.downloadJson(geojsonBoundaryPolygon, overpassQuery);
    expect(jsonContent.elements).toBeDefined();
    expect(jsonContent.elements).toEqual(responseObject.elements);

});

test('download geojson data from overpass', async function() {

    const geojsonContent = await OsmOverpassDownloader.downloadGeojson(geojsonBoundaryPolygon, overpassQuery);
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

test('download xml data from overpass', async function() {

    const xmlContent = await OsmOverpassDownloader.downloadXml(geojsonBoundaryPolygon, overpassQuery);
    expect(xmlContent).toEqual(xmlResponse);

});