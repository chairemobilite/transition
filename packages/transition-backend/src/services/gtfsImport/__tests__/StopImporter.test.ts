/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import NodeCollection from 'transition-common/lib/services/nodes/NodeCollection';
import Node from 'transition-common/lib/services/nodes/Node';

import { gtfsValidSimpleData, defaultImportData, gtfsValidTransitionGeneratedData } from './GtfsImportData.test';
import StopImporter from '../StopImporter';

let currentData: any = gtfsValidSimpleData;
const nodeSaveFct = Node.prototype.save = jest.fn();
const nodesInRangeFct = NodeCollection.prototype.nodesInWalkingTravelTimeRadiusSecondsAround = jest.fn();

const getNodesInRangeImplementation = (nodeCollection: NodeCollection) => {
    return (geometry, maxWalkingTravelTimeRadiusSeconds) => {
        const stopToImport = currentData['stops.txt'].find(stop => parseFloat(stop.stop_lon) === geometry.coordinates[0] && parseFloat(stop.stop_lat) === geometry.coordinates[1])
        if (!stopToImport) {
            throw 'Stop not found';
        }
        // For nodes starting with 111, Get all nodes starting with 111 in the collection with the same code having a distance of 0
        if (stopToImport.stop_code.startsWith('111') && maxWalkingTravelTimeRadiusSeconds !== 1) {
            return nodeCollection.getFeatures()
                .filter(n => n.properties.code.startsWith('111'))
                .map(n => ({
                    id: n.properties.id,
                    walkingTravelTimesSeconds: stopToImport.stop_code === n.properties.code ? 0 : 30,
                    walkingDistancesMeters: stopToImport.stop_code === n.properties.code ? 0 : 30
                }));
        }
        // Otherwise, find that same node if it's in the collection
        const node = nodeCollection.getFeatures().find(n => n.properties.code === stopToImport.stop_code);
        if (node) {
            return [{id: node.properties.id, walkingTravelTimesSeconds: 0, walkingDistancesMeters: 0}];
        }
        return [];
    };
};

jest.mock('chaire-lib-backend/lib/services/files/CsvFile', () => {
    return {
        parseCsvFile: jest.fn().mockImplementation(async (filePath, rowCallback, _options) => {
            const data = currentData[filePath];
            if (data && data.length > 0) {
                for (let i = 0; i < data.length; i++) {
                    rowCallback(data[i], i);
                }
            }
        })
    }
});

const stopToImportData = (data) => {
    const { stop_lat, stop_lon, location_type, wheelchair_boarding, ...rest } = data;
    return { 
        stop_lat: parseFloat(stop_lat), 
        stop_lon: parseFloat(stop_lon), 
        location_type: location_type === '' ? 0 : !location_type ? 0 : parseInt(location_type),
        wheelchair_boarding: wheelchair_boarding === '' ? 0 : !wheelchair_boarding ? 0 : parseInt(wheelchair_boarding),
        ...rest };
} 

beforeEach(() => {
    nodeSaveFct.mockClear();
});

describe('GTFS Stop import preparation', () => {
    test('Test prepare stop data, basic data', async () => {
        currentData = gtfsValidSimpleData
        const collection = new NodeCollection([], {}, undefined)

        const importer = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(gtfsValidSimpleData['stops.txt'].length);
        expect(data).toEqual(gtfsValidSimpleData['stops.txt'].map(stop => ({
            stop: stopToImportData(stop) 
        })));
    });

    test('Test prepare stop data, from Transition', async () => {
        currentData = gtfsValidTransitionGeneratedData;
        const collection = new NodeCollection([], {}, undefined)

        const importer = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(gtfsValidSimpleData['stops.txt'].length);
        expect(data).toEqual(gtfsValidSimpleData['stops.txt'].map((stop, index) => ({
                stop: {
                    ...stopToImportData(stop),
                    tr_node_color: '#ffeedd', 
                    tr_routing_radius_meters: 50,
                    tr_default_dwell_time_seconds: 60, 
                    tr_can_be_used_as_terminal: index % 2 === 0 ? true : false
                }
            })
        ));
    });

    test('Test prepare stop data, other types of stops', async() => {
        currentData = {
            'stops.txt': [
                { stop_id: 'da587d05-45d6-461b-b4a1-7383d4b6f858', stop_code: '1111', stop_name: 'Corner Unit W and Test N', stop_lat: '', stop_lon: '', location_type: '3', parent_station: '' },
                { stop_id: '9eae22c9-333b-4734-b9ea-b351fd4ce187', stop_code: '1112', stop_name: '', stop_lat: '45.595473682', stop_lon: '-73.642621307', location_type: '0', parent_station: '' },
            ]
        };

        const collection = new NodeCollection([], {}, undefined)

        const importer = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await importer.prepareImportData();
        expect(data.length).toEqual(currentData['stops.txt'].length - 1);
        expect(data).toEqual(currentData['stops.txt']
            .filter(stop => stop.stop_lat !== '')
            .map(stop => ({
                stop: stopToImportData(stop) 
            })
        ));   
    })
});


describe('GTFS Stops import', () => {

    test('Test import stop data, no existing data', async () => {
        currentData = gtfsValidSimpleData;
        const collection = new NodeCollection([], {}, undefined)
        nodesInRangeFct.mockImplementation(getNodesInRangeImplementation(collection));
        
        const importData = gtfsValidSimpleData['stops.txt'].map(stop => ({
            stop: stopToImportData(stop) 
        }));
        
        const objectImporter = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await objectImporter.import(importData, Object.assign({}, defaultImportData));

        // 4 nodes should have been aggregated, so there are 3 less nodes
        expect(collection.size()).toEqual(importData.length - 3);
        expect(nodeSaveFct).toHaveBeenCalledTimes(importData.length - 3);

        // Make sure the number of stops matches
        const nbStops = collection.getFeatures().map(node => (node.properties.data.stops || []).length).reduce((sum, val) => sum+= val);
        expect(nbStops).toEqual(importData.length);

        // All nodes should be new
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const oneNode = data[keys[i]];
            expect(oneNode.isNew()).toBeTruthy();
            // expect no undefined attributes in the gtfs data
            const stopData = oneNode.getAttributes().data?.stops as any;
            expect(stopData).toBeDefined();
            for (let j = 0; j < stopData.length; j++) {
                const gtfsData = stopData[j].data.gtfs as any;
                expect(gtfsData).toBeDefined();
                Object.keys(gtfsData).forEach(key => expect(gtfsData[key]).toBeDefined());
            }
        }
    });

    test('Test import stop data, with color', async () => {
        currentData = gtfsValidSimpleData;
        const collection = new NodeCollection([], {}, undefined)
        nodesInRangeFct.mockImplementation(getNodesInRangeImplementation(collection));
        
        const importData = gtfsValidSimpleData['stops.txt'].map(stop => ({
            stop: stopToImportData(stop) 
        }));

        const defaultImportDataWithColor = Object.assign({}, defaultImportData, { nodes_color: '#123456' });
        const objectImporter = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await objectImporter.import(importData, Object.assign({}, defaultImportDataWithColor));

        // All nodes should be new
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const oneNode = data[keys[i]];
            expect(oneNode.getAttributes().color).toEqual('#123456');
        }
    });

    test('Test import stop data, existing data', async () => {
        currentData = gtfsValidSimpleData;

        // Map each stop to a node to add to the collection
        const existingNodes = gtfsValidSimpleData['stops.txt'].map(stop => ({
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)] },
            properties: {
                id: uuidV4(),
                code: stop.stop_code,
                geography: { type: 'Point' as const, coordinates: [parseFloat(stop.stop_lon), parseFloat(stop.stop_lat)] },
                name: stop.stop_name,
                routing_radius_meters: 20,
                default_dwell_time_seconds: 30,
                data: {
                    stops: []
                }
            }
        }));

        const collection = new NodeCollection(existingNodes, {}, undefined)
        nodesInRangeFct.mockImplementation(getNodesInRangeImplementation(collection));

        const importData = gtfsValidSimpleData['stops.txt'].map(stop => ({
            stop: stopToImportData(stop)
        }));
        
        const objectImporter = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await objectImporter.import(importData, Object.assign({}, defaultImportData));

        // No new nodes, but they should have been updated
        expect(collection.size()).toEqual(importData.length);
        expect(nodeSaveFct).toHaveBeenCalledTimes(importData.length);

        // Make sure the number of stops matches
        const nbStops = collection.getFeatures().map(node => (node.properties.data.stops || []).length).reduce((sum, val) => sum+= val);
        expect(nbStops).toEqual(importData.length);

        // All nodes should already exist and have one stop
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const oneNode = data[keys[i]];
            expect(oneNode.isNew()).toBeFalsy();
            expect((oneNode.getAttributes().data.stops || []).length).toEqual(1);
        }
    });

    test('Test import stop data, smaller aggregate node range', async () => {
        currentData = gtfsValidSimpleData;
        const collection = new NodeCollection([], {}, undefined)
        nodesInRangeFct.mockImplementation(getNodesInRangeImplementation(collection));
        
        const importData = gtfsValidSimpleData['stops.txt'].map(stop => ({
            stop: stopToImportData(stop)
        }));
        
        const objectImporter = new StopImporter({ directoryPath: '', nodes: collection });
        const data = await objectImporter.import(importData, Object.assign({}, defaultImportData, { stopAggregationWalkingRadiusSeconds: 1 }));

        // 4 nodes should have been aggregated, so there are 3 less nodes
        expect(collection.size()).toEqual(importData.length);
        expect(nodeSaveFct).toHaveBeenCalledTimes(importData.length);

        // Make sure the number of stops matches
        const nbStops = collection.getFeatures().map(node => (node.properties.data.stops || []).length).reduce((sum, val) => sum+= val);
        expect(nbStops).toEqual(importData.length);
    });

    test('Test import stop data, from Transition', async () => {
        currentData = gtfsValidTransitionGeneratedData;

        const collection = new NodeCollection([], {}, undefined)
        nodesInRangeFct.mockImplementation(getNodesInRangeImplementation(collection));
        
        const objectImporter = new StopImporter({ directoryPath: '', nodes: collection });
        const importData = await objectImporter.prepareImportData();
        const data = await objectImporter.import(importData, Object.assign({}, defaultImportData));

        // Verify that all nodes have their fields from Transition populated
        const keys = Object.keys(data);
        for (let i = 0; i < keys.length; i++) {
            const oneNode = data[keys[i]];
            const originalData = currentData['stops.txt'].find(data => data.stop_code === oneNode.getAttributes().code);
            expect(originalData).toBeDefined();
            expect(oneNode.getAttributes().color).toEqual(originalData.tr_node_color);
            // Radius may have been updated if stops are further away than original radius
            expect(oneNode.getAttributes().routing_radius_meters).toBeGreaterThanOrEqual(parseInt(originalData.tr_routing_radius_meters));
            expect(oneNode.getAttributes().default_dwell_time_seconds).toEqual(parseInt(originalData.tr_default_dwell_time_seconds));
            expect(oneNode.getAttributes().data.canBeUsedAsTerminal).toEqual(originalData.tr_can_be_used_as_terminal === 'true' ? true : false);
        }
    });

});
