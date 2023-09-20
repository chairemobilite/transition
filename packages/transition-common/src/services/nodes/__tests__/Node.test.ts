/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';
import { distance as turfDistance } from '@turf/turf';

import Node, { StopAttributes } from '../Node';

const nodeAttributes1 = {
    id: uuidV4(),
    name: 'Node1',
    data: {
        variables: {}
    },
    geography: { type: 'Point' as const, coordinates: [-73, 45] },
    station_id: 'abdefg',
    code: 'nodeCode',
    is_enabled: true,
    routing_radius_meters: 50,
    default_dwell_time_seconds: 20,
    is_frozen: false
};

const nodeAttributes2= {
    id: uuidV4(),
    name: 'Node2',
    geography: { type: 'Point' as const, coordinates: [-74, 46] },
    station_id: 'abdefg',
    code: 'nodeCode2',
    is_enabled: true,
    is_frozen: false
};

test('should construct new nodes', function() {

    const node1 = new Node(nodeAttributes1, true);
    expect(node1.getAttributes()).toEqual({ ...nodeAttributes1, data: { ...nodeAttributes1.data, routingRadiusPixelsAtMaxZoom: expect.anything() } });
    expect(node1.isNew()).toBe(true);

    const node2 = new Node(nodeAttributes2, false);
    expect(node2.getAttributes()).toEqual({ ...nodeAttributes2, routing_radius_meters: 50, default_dwell_time_seconds: 20, data: { routingRadiusPixelsAtMaxZoom: expect.anything() }});
    expect(node2.isNew()).toBe(false);

});

test('should validate', function() {
    const node = new Node(nodeAttributes1, true);
    expect(node.validate()).toBe(true);

    node.set('routing_radius_meters', 500);
    expect(node.validate()).toBe(false);
    node.set('routing_radius_meters', -1);
    expect(node.validate()).toBe(false);
    node.set('routing_radius_meters', 1);
    expect(node.validate()).toBe(false);
    node.set('routing_radius_meters', 50);
    expect(node.validate()).toBe(true);

    node.set('default_dwell_time_seconds', -1);
    expect(node.validate()).toBe(false);
});

test('should save and delete in memory', function() {
    const node = new Node(nodeAttributes1, true);
    expect(node.isNew()).toBe(true);
    expect(node.isDeleted()).toBe(false);
    node.saveInMemory();
    expect(node.isNew()).toBe(false);
    node.deleteInMemory();
    expect(node.isDeleted()).toBe(true);
});

test('static methods should work', function() {
    expect(Node.getPluralName()).toBe('nodes');
    expect(Node.getCapitalizedPluralName()).toBe('Nodes');
    expect(Node.getDisplayName()).toBe('Node');
    const node = new Node(nodeAttributes1, true);
    expect(node.getPluralName()).toBe('nodes');
    expect(node.getCapitalizedPluralName()).toBe('Nodes');
    expect(node.getDisplayName()).toBe('Node');
});

describe('Manage stops in node', () => {

    const stop1: StopAttributes = {
        id: uuidV4(),
        code: 'stop1',
        name: 'my stop 1',
        geography: { type: 'Point' as const, coordinates: [-73.62081170082092, 45.54424540121843] },
        data: {}
    };
    const stop2: StopAttributes = {
        id: uuidV4(),
        code: 'stop2',
        name: 'my stop 2',
        geography: { type: 'Point' as const, coordinates: [-73.62125158309935, 45.54342636609218] },
        data: {}
    };
    const nodeAttributesCopy = Object.assign({}, nodeAttributes1);
    nodeAttributesCopy.geography = { type: 'Point' as const, coordinates: [-73.62123012542725, 45.543937325185645] };
    const distanceFromStop1 = turfDistance(nodeAttributesCopy.geography, stop1.geography, { units: 'meters' });
    const distanceFromStop2 = turfDistance(nodeAttributesCopy.geography, stop2.geography, { units: 'meters' });
    
    test('Add stops', () => {
        const node = new Node(nodeAttributesCopy, true);

        // At the beginning, there are not stops
        expect(node.getAttributes().data.stops).toBeUndefined();

        // Add the data from stop1 2 times, there should be one stop at the end
        node.addStop(stop1);
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);

        node.addStop(stop1);
        expect(node.getAttributes().data.stops?.length).toEqual(1);

        // Add the data from stop2
        node.addStop(stop2);
        expect(node.getAttributes().data.stops?.length).toEqual(2);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);
        expect((node.getAttributes().data.stops as any)[1]).toEqual(stop2);

        // Node's final attributes after stop additions
        expect(node.toGeojson().geometry).toEqual(nodeAttributesCopy.geography);
        expect(node.getAttributes().routing_radius_meters).toEqual(Math.ceil(Math.max(distanceFromStop1, distanceFromStop2)));
    });

    test('Update stops', () => {
        const node = new Node(nodeAttributesCopy, true);

        // Add the data from stop1, then update that same stop
        node.addStop(stop1);
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);

        const modifiedStop1 = Object.assign({}, stop1);
        modifiedStop1.data = {
            something: 'abcdef'
        }
        node.addStop(modifiedStop1);
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(modifiedStop1);

        // Modify the ID, but keep all the same
        modifiedStop1.id = uuidV4();
        node.addStop(modifiedStop1, { updateCentroid: false });
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(modifiedStop1);

        // Node's final attributes after stop additions, only one stop is there and the distance is smaller than radius
        expect(node.toGeojson().geometry).toEqual(nodeAttributesCopy.geography);
        expect(node.getAttributes().routing_radius_meters).toEqual(nodeAttributesCopy.routing_radius_meters);
    });

    test('Add stops and update centroid', () => {
        const node = new Node(nodeAttributesCopy, true);

        // At the beginning, there are not stops
        expect(node.getAttributes().data.stops).toBeUndefined();

        // Add the data from stop1 2 times, there should be one stop at the end
        node.addStop(stop1, { updateCentroid: true });
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);

        node.addStop(stop1, { updateCentroid: true });
        expect(node.getAttributes().data.stops?.length).toEqual(1);

        // Add the data from stop2
        node.addStop(stop2, { updateCentroid: true });
        expect(node.getAttributes().data.stops?.length).toEqual(2);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);
        expect((node.getAttributes().data.stops as any)[1]).toEqual(stop2);

        // Node's final attributes after stop additions. The centroid should have been updated so stops are within current radius
        expect(node.toGeojson().geometry).not.toEqual(nodeAttributesCopy.geography);
        expect(node.getAttributes().routing_radius_meters).toEqual(nodeAttributesCopy.routing_radius_meters);
    });

    test('Remove stops', () => {
        const node = new Node(nodeAttributesCopy, true);

        // Add the data from stop1, then remove
        node.addStop(stop1);
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        expect((node.getAttributes().data.stops as any)[0]).toEqual(stop1);

        node.removeStop('arbitrary');
        expect(node.getAttributes().data.stops?.length).toEqual(1);
        node.removeStop(stop1.id);
        expect(node.getAttributes().data.stops?.length).toEqual(0);
    });

    test('Get stop', () => {
        const node = new Node(nodeAttributesCopy, true);

        // Add the 2 stops
        node.addStop(stop1);
        node.addStop(stop2);

        expect(node.getStop(stop1.id)).toEqual(stop1);
        expect(node.getStop(stop2.id)).toEqual(stop2);
        expect(node.getStop('wrong id')).toBeUndefined();
    });

})