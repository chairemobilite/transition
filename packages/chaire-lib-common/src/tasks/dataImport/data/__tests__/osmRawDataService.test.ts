/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import fs from 'fs';
import TestUtils from '../../../../test/TestUtils';

import { getOsmNodesFor, getNodesInside, getEntrancesForBuilding } from '../osmRawDataService';
import { DataFileOsmRaw, DataOsmRaw, OsmRawDataType } from '../dataOsmRaw';
const osmRawDataFromFile = new DataFileOsmRaw(
    '',
    { readFileAbsolute: () => fs.readFileSync(__dirname + '/testDataOsmRaw.json') }
);

//const osmGeojson = JSON.parse(fs.readFileSync(__dirname + "/testDataOsm.geojson").toString());

const outputRelationWaysSortedNodeIds = [
    7589797725,
    7589797726,
    7589797727,
    7589797728,
    7589797729,
    7589797730,
    7589797731,
    7589797732,
    7589797733,
    7589797734,
    7589797735,
    7589797736,
    7589797737,
    7589797738
];

const outputPolygonWaysSortedNodeIds = [
    7589797713,
    7589797714,
    7589797715,
    7589797716,
    7589797717,
    7589797718,
    7589797719,
    7589797720,
    7589797782,
    7589857586
];

const node1 = TestUtils.makePoint([-72.800239, 45.828022]);
const node2 = TestUtils.makePoint([-72.796183, 45.834869]);
const node3 = TestUtils.makePoint([-72.793028, 45.836065]);
const node4 = TestUtils.makePoint([-72.790947, 45.832672]);
const node5 = TestUtils.makePoint([-72.790582, 45.833927]);
const node6 = TestUtils.makePoint([-72.791913, 45.831057]);
const node7 = TestUtils.makePoint([-72.80498, 45.827244]);
const node8 = TestUtils.makePoint([-72.804487, 45.827543]);
const node9 = TestUtils.makePoint([-72.803779, 45.830145]);
const node10 = TestUtils.makePoint([-72.808778, 45.833434]);
const node11 = TestUtils.makePoint([-72.804658, 45.834645]);
const node12 = TestUtils.makePoint([-72.80413, 45.833886]);
const node13 = TestUtils.makePoint([-72.796526, 45.82856]);
const node14 = TestUtils.makePoint([-72.800002, 45.829068]);
const node15 = TestUtils.makePoint([-72.796333, 45.827872]);
const polygon1Node1 = TestUtils.makePoint([-72.793844, 45.836962]);
const polygon1Node2 = TestUtils.makePoint([-72.798543, 45.834167]);
const polygon1Node3 = TestUtils.makePoint([-72.793715, 45.829696]);
const polygon2Node1 = TestUtils.makePoint([-72.798951, 45.829726]);
const polygon2Node3 = TestUtils.makePoint([-72.797578, 45.826392]);
const polygon2Node5 = TestUtils.makePoint([-72.797599, 45.828978]);
const osmDataElements = [{
    "type": "node" as const,
    "id": 1,
    "lat": node1.geometry.coordinates[1],
    "lon": node1.geometry.coordinates[0],
    "tags": { 'routing:entrance': 'main' }
},
{
    "type": "node" as const,
    "id": 2,
    "lat": node2.geometry.coordinates[1],
    "lon": node2.geometry.coordinates[0],
    "tags": { entrance: 'shop' }
},
{
    "type": "node" as const,
    "id": 3,
    "lat": node3.geometry.coordinates[1],
    "lon": node3.geometry.coordinates[0],
    "tags": { entrance: 'main' }
},
{
    "type": "node" as const,
    "id": 4,
    "lat": node4.geometry.coordinates[1],
    "lon": node4.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 5,
    "lat": node5.geometry.coordinates[1],
    "lon": node5.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 6,
    "lat": node6.geometry.coordinates[1],
    "lon": node6.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 7,
    "lat": node7.geometry.coordinates[1],
    "lon": node7.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 8,
    "lat": node8.geometry.coordinates[1],
    "lon": node8.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 9,
    "lat": node9.geometry.coordinates[1],
    "lon": node9.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 10,
    "lat": node10.geometry.coordinates[1],
    "lon": node10.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 11,
    "lat": node11.geometry.coordinates[1],
    "lon": node11.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 12,
    "lat": node12.geometry.coordinates[1],
    "lon": node12.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 13,
    "lat": node13.geometry.coordinates[1],
    "lon": node13.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 14,
    "lat": node14.geometry.coordinates[1],
    "lon": node14.geometry.coordinates[0]
},
{
    "type": "node" as const,
    "id": 15,
    "lat": node15.geometry.coordinates[1],
    "lon": node15.geometry.coordinates[0],
    "tags": { 'routing:entrance': 'yes' }
},
{
    "type": "node" as const,
    "id": 16,
    "lat": polygon1Node1.geometry.coordinates[1],
    "lon": polygon1Node1.geometry.coordinates[0],
    tags: { entrance: 'yes' }
},
{
    "type": "node" as const,
    "id": 17,
    "lat": polygon1Node2.geometry.coordinates[1],
    "lon": polygon1Node2.geometry.coordinates[0],
},
{
    "type": "node" as const,
    "id": 18,
    "lat": polygon1Node3.geometry.coordinates[1],
    "lon": polygon1Node3.geometry.coordinates[0],
},
{
    "type": "node" as const,
    "id": 19,
    "lat": polygon2Node1.geometry.coordinates[1],
    "lon": polygon2Node1.geometry.coordinates[0],
},
{
    "type": "node" as const,
    "id": 20,
    "lat": polygon2Node3.geometry.coordinates[1],
    "lon": polygon2Node3.geometry.coordinates[0],
},
{
    "type": "node" as const,
    "id": 21,
    "lat": polygon2Node5.geometry.coordinates[1],
    "lon": polygon2Node5.geometry.coordinates[0],
},
{
    "type": "way" as const,
    "id": 1,
    nodes: [16, 17, 18, 3, 4, 16]
},
{
    "type": "way" as const,
    "id": 2,
    nodes: [19, 1, 20, 15, 21, 19]
},
{
    "type": "way" as const,
    "id": 3,
    nodes: [17, 18, 19, 17]
},
{
    "type": "way" as const,
    "id": 4,
    nodes: [16, 17, 18, 3, 4]
}];
const osmTestData = new DataOsmRaw({
    "elements": osmDataElements
});
const polygonWithHole: GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                [-72.812662, 45.827155],
                [-72.801032, 45.825869],
                [-72.801118, 45.83158],
                [-72.805882, 45.835228],
                [-72.808585, 45.833225],
                [-72.812104, 45.833045],
                [-72.812662, 45.827155]
            ],
            [
                [-72.807341, 45.827573],
                [-72.805152, 45.828209],
                [-72.802749, 45.827902],
                node7.geometry.coordinates,
                [-72.807341, 45.827573]
            ]
        ]
    },
    "properties": {}
};
const polygon1: GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "id": "way/1",
    "properties": {},
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                polygon1Node1.geometry.coordinates,
                polygon1Node2.geometry.coordinates,
                polygon1Node3.geometry.coordinates,
                node3.geometry.coordinates,
                node4.geometry.coordinates,
                polygon1Node1.geometry.coordinates,
            ]
        ]
    }
};
const polygon1AsLine: GeoJSON.Feature<GeoJSON.LineString, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "id": "way/4",
    "properties": {},
    "geometry": {
        "type": "LineString",
        "coordinates": [
            polygon1Node1.geometry.coordinates,
            polygon1Node2.geometry.coordinates,
            polygon1Node3.geometry.coordinates,
            node3.geometry.coordinates,
            node4.geometry.coordinates
        ]
    }
};
const polygon2: GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "properties": {},
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                polygon2Node1.geometry.coordinates,
                node1.geometry.coordinates,
                polygon2Node3.geometry.coordinates,
                node15.geometry.coordinates,
                polygon2Node5.geometry.coordinates,
                polygon2Node1.geometry.coordinates
            ]
        ]
    }
};
const polygonWithNoEntrance: GeoJSON.Feature<GeoJSON.Polygon, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "properties": {},
    "geometry": {
        "type": "Polygon",
        "coordinates": [
            [
                polygon1Node2.geometry.coordinates,
                polygon1Node3.geometry.coordinates,
                polygon2Node1.geometry.coordinates,
                polygon1Node2.geometry.coordinates
            ]
        ]
    }
};
const multipolygonWithHole: GeoJSON.Feature<GeoJSON.MultiPolygon, GeoJSON.GeoJsonProperties> = {
    "type": "Feature",
    "properties": {},
    "geometry": {
        "type": "MultiPolygon",
        "coordinates": [
            [
                [
                    [-72.812662, 45.827155],
                    [-72.801032, 45.825869],
                    [-72.801118, 45.83158],
                    [-72.805882, 45.835228],
                    [-72.808585, 45.833225],
                    [-72.812104, 45.833045],
                    [-72.812662, 45.827155]
                ],
                [
                    [-72.807341, 45.827573],
                    [-72.805152, 45.828209],
                    [-72.802749, 45.827902],
                    node7.geometry.coordinates,
                    [-72.807341, 45.827573]
                ]
            ],
            polygon1.geometry.coordinates
        ]
    }
};

describe('getOsmNodesFor', () => {
    test('getOsmNodesFor with polygon', () => {

        const inputWaysNodes = getOsmNodesFor(osmRawDataFromFile.query({ type: 'way' })[8], osmRawDataFromFile);
        const inputWaysSortedNodeIds = inputWaysNodes.map(function (node) {
            return node.id;
        });
        inputWaysSortedNodeIds.sort();

        expect(inputWaysSortedNodeIds).toEqual(outputPolygonWaysSortedNodeIds);
    });

    test('getOsmNodesFor with multipolygon', () => {

        const inputWaysNodes = getOsmNodesFor(osmRawDataFromFile.query({ type: 'relation' })[3], osmRawDataFromFile);
        const inputWaysSortedNodeIds = inputWaysNodes.map(function (node) {
            return node.id;
        });
        inputWaysSortedNodeIds.sort();

        expect(inputWaysSortedNodeIds).toEqual(outputRelationWaysSortedNodeIds);
    });
});

test('getNodesInside', () => {

    expect(getNodesInside(polygonWithHole, osmTestData, { ignoreBoundary: true} ).map(function(node) { return node.id; })).toEqual([9,12]);
    expect(getNodesInside(polygonWithHole, osmTestData,  ).map(function(node) { return node.id; })).toEqual([7,9,12]);
    expect(getNodesInside(polygon1, osmTestData, { ignoreBoundary: true} ).map(function(node) { return node.id; })).toEqual([2]);
    expect(getNodesInside(polygon1, osmTestData, { ignoreBoundary: false} ).map(function(node) { return node.id; })).toEqual([2,3,4,16,17,18]);
    expect(getNodesInside(polygon2, osmTestData, { ignoreBoundary: true} ).map(function(node) { return node.id; })).toEqual([]);
    expect(getNodesInside(polygon2, osmTestData, { ignoreBoundary: false} ).map(function(node) { return node.id; })).toEqual([1,15,19,20,21]);
    expect(getNodesInside(multipolygonWithHole, osmTestData, { ignoreBoundary: true} ).map(function(node) { return node.id; })).toEqual([2,9,12]);
    expect(getNodesInside(multipolygonWithHole, osmTestData, { ignoreBoundary: false} ).map(function(node) { return node.id; })).toEqual([2,3,4,7,9,12,16,17,18]);
});

describe('getEntrances', () => {

    // There's a main entrance (3) and an entrance yes (16) on the building, and a shop entrance (2) inside the building
    // lineData is same as building, but as a LineString instead
    const building = osmTestData.find({ type: 'way', id: 1 }) as OsmRawDataType;
    const lineData = osmTestData.find({ type: 'way', id: 4 }) as OsmRawDataType;

    test('Default parameters, should return main door', () => {
        expect(getEntrancesForBuilding(polygon1, building, osmTestData).map(function(node) { return node.id; })).toEqual([3]);
    });

    test('Specify type, no entrance of that type, should not return entrance=yes', () => {
        expect(getEntrancesForBuilding(polygon1, building, osmTestData, { entranceTypes: ['shop'] }).map(function(node) { return node.id; })).toEqual([]);
    });

    test('Specify multiple types, should return that type', () => {
        expect(getEntrancesForBuilding(polygon1, building, osmTestData, { entranceTypes: ['main', 'home'] }).map(function(node) { return node.id; })).toEqual([3]);
    });

    test('Include inside, should return main door', () => {
        expect(getEntrancesForBuilding(polygon1, building, osmTestData, { includeInside: true }).map(function(node) { return node.id; })).toEqual([3]);
    });

    test('Include inside, and specify types', () => {
        expect(getEntrancesForBuilding(polygon1, building, osmTestData, { entranceTypes: ['shop', 'home'], includeInside: true }).map(function(node) { return node.id; })).toEqual([2]);
        expect(getEntrancesForBuilding(polygon1, building, osmTestData, { entranceTypes: ['shop', 'main'], includeInside: true }).map(function(node) { return node.id; })).toEqual([3,2]);
    });

    test('With routing:entrances instead of entrances', () => {
        const buildingWithRoutingEntrances = osmTestData.find({ type: 'way', id: 2 }) as OsmRawDataType;
        expect(getEntrancesForBuilding(polygon2, buildingWithRoutingEntrances, osmTestData, { entranceTypes: ['shop', 'home'], includeInside: true }).map(function(node) { return node.id; })).toEqual([15]);
        expect(getEntrancesForBuilding(polygon2, buildingWithRoutingEntrances, osmTestData, { entranceTypes: ['shop', 'main'], includeInside: true }).map(function(node) { return node.id; })).toEqual([1]);
        expect(getEntrancesForBuilding(polygon2, buildingWithRoutingEntrances, osmTestData, { entranceTypes: ['shop', 'main'], includeInside: true, findRoutingEntrance: false }).map(function(node) { return node.id; })).toEqual([]);
    });

    test('No entrances', () => {
        const buildingWithNoEntrance = osmTestData.find({ type: 'way', id: 3 }) as OsmRawDataType;
        expect(getEntrancesForBuilding(polygon2, buildingWithNoEntrance, osmTestData, { entranceTypes: ['shop', 'home'], includeInside: true }).map(function(node) { return node.id; })).toEqual([]);
        expect(getEntrancesForBuilding(polygon2, buildingWithNoEntrance, osmTestData, { entranceTypes: ['shop', 'main'], includeInside: true }).map(function(node) { return node.id; })).toEqual([]);
    });

    test('With line string', () => {
        // Entrance with that type
        expect(getEntrancesForBuilding(polygon1AsLine, lineData, osmTestData).map(function(node) { return node.id; })).toEqual([3]);
        // No entrance
        expect(getEntrancesForBuilding(polygon1AsLine, lineData, osmTestData, { entranceTypes: ['shop'] }).map(function(node) { return node.id; })).toEqual([]);
    });

    test('With multi line string', () => {
        // Turn the line string to a multi line string
        const multiLineFeature = Object.assign({}, polygon1AsLine) as any;
        multiLineFeature.geometry = { type: 'MultiLineString', coordinates: [multiLineFeature.geometry.coordinates]};

        // Entrance with that type
        expect(getEntrancesForBuilding(multiLineFeature, lineData, osmTestData).map(function(node) { return node.id; })).toEqual([3]);
        // No entrance
        expect(getEntrancesForBuilding(multiLineFeature, lineData, osmTestData, { entranceTypes: ['shop'] }).map(function(node) { return node.id; })).toEqual([]);
    });
});