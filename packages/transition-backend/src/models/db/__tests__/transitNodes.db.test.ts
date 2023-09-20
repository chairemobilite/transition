/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import _cloneDeep from 'lodash/cloneDeep';

import dbQueries from '../transitNodes.db.queries';
import pathsDbQueries from '../transitPaths.db.queries';
import GeojsonCollection from 'transition-common/lib/services/nodes/NodeCollection';
import ObjectClass from 'transition-common/lib/services/nodes/Node';
import Path from 'transition-common/lib/services/path/Path';

const objectName = 'node';

const newObjectAttributes = {
    id: uuidV4(),
    code: '0001',
    name: 'NewNode 1',
    internal_id: 'Test1',
    integer_id: 1,
    geography: {
        type: "Point" as const,
        coordinates: [-73.0, 45.0]
    },
    color: '#ffff00',
    is_enabled: true,
    is_frozen: false,
    description: 'New node description',
    default_dwell_time_seconds: 25,
    routing_radius_meters: 50,
    data: {
        foo: 'bar',
        transferableNodes: {
            nodesIds: [uuidV4(), uuidV4(), uuidV4(), uuidV4(), uuidV4()],
            walkingTravelTimesSeconds: [125, 582, 654, 497, 115],
            walkingDistancesMeters: [145, 574, 944, 579, 157]
        }
    }
};

const newObjectAttributes2 = {
    id: uuidV4(),
    code: '0002',
    name: 'NewSNode 2',
    internal_id: 'Test2',
    integer_id: 2,
    geography: {
        type: "Point" as const,
        coordinates: [-73.2, 45.4]
    },
    color: '#00ff00',
    is_enabled: true,
    is_frozen: false,
    data: {
        foo2: 'bar2',
        transferableNodes: {
            nodesIds: [],
            walkingTravelTimesSeconds: [],
            walkingDistancesMeters: []
        }
    }
};

const newObjectAttributes3 = {
    id: uuidV4(),
    code: '0003',
    name: 'NewSNode 3',
    internal_id: 'Test3',
    integer_id: 3,
    geography: {
        type: "Point" as const,
        coordinates: [-73.3, 45.3]
    },
    color: '#00ffff',
    is_enabled: true,
    is_frozen: false,
    data: {
        transferableNodes: {
            nodesIds: [],
            walkingTravelTimesSeconds: [],
            walkingDistancesMeters: []
        }
    }
};

const newPathWithTwoAssociatedNodesAttributes = {
    id: uuidV4(),
    is_frozen: false,
    is_enabled: true,
    line_id: null,
    integer_id: 1,
    nodes: [uuidV4(), uuidV4(), newObjectAttributes.id, uuidV4(), uuidV4(), newObjectAttributes2.id, uuidV4(), uuidV4()],
    stops: [],
    segments: [],
    data: {
        nodeTypes: [],
        waypointTypes: [],
        waypoints: []
    },
    direction: 'outbound',
    geography: null
};

const newPathWithOneAssociatedNodeAttributes = {
    id: uuidV4(),
    is_frozen: false,
    line_id: null,
    integer_id: 4,
    nodes: [newObjectAttributes2.id],
    segments: [],
    data: {
        nodeTypes: [],
        waypointTypes: [],
        waypoints: []
    },
    direction: 'other',
    geography: null
};

const updatedAttributes = {
    code: '0001b',
    description: 'Changed node description'
};

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await pathsDbQueries.truncate();
});

afterAll(async () => {
    await dbQueries.truncate();
    await pathsDbQueries.truncate();
    dbQueries.destroy();
});

describe(`${objectName}`, () => {

    test('exists should return false if object is not in database', async () => {

        const exists = await dbQueries.exists(uuidV4())
        expect(exists).toBe(false);

    });

    test('should create a new object in database', async () => {

        const newObject = new ObjectClass(newObjectAttributes, true);
        const id = await dbQueries.create(newObject.attributes)
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read a new object in database', async () => {

        const attributes = await dbQueries.read(newObjectAttributes.id) as any;
        delete attributes.updated_at;
        delete attributes.created_at;
        const _newObjectAttributes = _cloneDeep(newObjectAttributes) as any;
        delete _newObjectAttributes.data.transferableNodes;
        expect(attributes).toMatchObject(_newObjectAttributes);

    });

    test('should update an object in database', async () => {

        const id = await dbQueries.update(newObjectAttributes.id, updatedAttributes);
        expect(id).toBe(newObjectAttributes.id);

    });

    test('should read an updated object from database', async () => {

        const updatedObject = await dbQueries.read(newObjectAttributes.id) as any;
        for (const attribute in updatedAttributes) {
            expect(updatedObject[attribute]).toBe(updatedAttributes[attribute]);
        }

    });

    test('should create a second new object in database, with array returning', async () => {

        const newObject = new ObjectClass(newObjectAttributes2, true);
        const { id, integer_id } = await dbQueries.create(newObject.attributes, ['id', 'integer_id']) as {[key: string]: unknown}
        expect(id).toBe(newObjectAttributes2.id);
        expect(integer_id).toBeDefined();

    });

    test('should read geojson collection from database', async () => {

        const _collection = await dbQueries.geojsonCollection();
        const geojsonCollection = new GeojsonCollection(_collection.features, {}, undefined);
        const _newObjectAttributes = Object.assign({}, newObjectAttributes) as any;
        const _newObjectAttributes2 = Object.assign({}, newObjectAttributes2) as any;
        const collection = geojsonCollection.features;
        expect(collection.length).toBe(2);
        for (const attribute in updatedAttributes) {
            _newObjectAttributes[attribute] = updatedAttributes[attribute];
        }
        delete _newObjectAttributes.data.transferableNodes;
        delete _newObjectAttributes2.data.transferableNodes;
        delete collection[0].properties.created_at;
        delete collection[0].properties.updated_at;
        delete collection[0].properties.data.routingRadiusPixelsAtMaxZoom;
        delete collection[1].properties.created_at;
        delete collection[1].properties.updated_at;
        delete collection[1].properties.data.routingRadiusPixelsAtMaxZoom;

        expect(collection[0].properties.id).toBe(_newObjectAttributes.id);
        expect(collection[0].properties).toMatchObject(_newObjectAttributes);
        expect(collection[1].properties.id).toBe(_newObjectAttributes2.id);
        expect(collection[1].properties).toMatchObject(_newObjectAttributes2);

    });


    test('should get nodes associated path ids from database', async () => {

        await pathsDbQueries.createMultiple([
            new Path(newPathWithTwoAssociatedNodesAttributes, false).getAttributes(),
            new Path(newPathWithOneAssociatedNodeAttributes, true).getAttributes(),
        ]);

        await expect(async () => {
            await dbQueries.getAssociatedPathIds([])
        }).rejects.toThrowError("Cannot get nodes associated path ids from tables tr_transit_nodes and tr_transit_paths (error: Node ids array is empty (You must provide at least one node id) (DBQNGAP0002))");
        await expect(async () => {
            await dbQueries.getAssociatedPathIds(['foo'])
        }).rejects.toThrowError("Cannot get nodes associated path ids from tables tr_transit_nodes and tr_transit_paths (error: At least one node id is not a valid uuid (DBQNGAP0001))");
        await expect(async () => {
            await dbQueries.getAssociatedPathIds([newObjectAttributes.id, 'foo'])
        }).rejects.toThrowError("Cannot get nodes associated path ids from tables tr_transit_nodes and tr_transit_paths (error: At least one node id is not a valid uuid (DBQNGAP0001))");
        await expect(async () => {
            await dbQueries.getAssociatedPathIds([newObjectAttributes.id, newObjectAttributes3.id])
        }).rejects.toThrowError("Cannot get nodes associated path ids from tables tr_transit_nodes and tr_transit_paths (error: The number of nodes received do not match the number of nodes sent in the query (DBQNGAP0003))");

        // Add a third node, not associated with a path
        const newObject = new ObjectClass(newObjectAttributes3, true);
        await dbQueries.create(newObject.attributes);

        const pathIdsByNodeIdSingleNode1 = await dbQueries.getAssociatedPathIds([newObjectAttributes.id]);
        expect(pathIdsByNodeIdSingleNode1).toEqual({
            [newObjectAttributes.id]: [newPathWithTwoAssociatedNodesAttributes.id]
        });
        const pathIdsByNodeIdSingleNode2 = await dbQueries.getAssociatedPathIds([newObjectAttributes2.id]);
        expect(pathIdsByNodeIdSingleNode2).toEqual({
            [newObjectAttributes2.id]: [newPathWithTwoAssociatedNodesAttributes.id, newPathWithOneAssociatedNodeAttributes.id]
        });
        const pathIdsByNodeIdTwoNodes = await dbQueries.getAssociatedPathIds([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(pathIdsByNodeIdTwoNodes).toEqual({
            [newObjectAttributes.id]: [newPathWithTwoAssociatedNodesAttributes.id],
            [newObjectAttributes2.id]: [newPathWithTwoAssociatedNodesAttributes.id, newPathWithOneAssociatedNodeAttributes.id]
        });
        const pathIdsByNodeIdAllNodes = await dbQueries.getAssociatedPathIds([newObjectAttributes.id, newObjectAttributes2.id, newObjectAttributes3.id]);
        expect(pathIdsByNodeIdAllNodes).toEqual({
            [newObjectAttributes.id]: [newPathWithTwoAssociatedNodesAttributes.id],
            [newObjectAttributes2.id]: [newPathWithTwoAssociatedNodesAttributes.id, newPathWithOneAssociatedNodeAttributes.id],
            [newObjectAttributes3.id]: []
        });
    });

    test('should not delete nodes from database if paths exist', async () => {

        // delete an object that has paths associated, it should not be possible
        const id = await dbQueries.delete(newObjectAttributes.id);
        expect(id).toBeUndefined();
        expect(await dbQueries.exists(newObjectAttributes.id)).toBe(true);

        // Delete multiple nodes, some of which have paths associated, only the
        // one without path should be deleted
        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id, newObjectAttributes3.id]);
        expect(ids).toEqual([newObjectAttributes3.id]);
        expect(await dbQueries.exists(newObjectAttributes.id)).toBe(true);
        expect(await dbQueries.exists(newObjectAttributes2.id)).toBe(true);
        expect(await dbQueries.exists(newObjectAttributes3.id)).toBe(false);

    });

    test('should delete objects from database', async () => {
        // delete paths
        pathsDbQueries.truncate();

        const id = await dbQueries.delete(newObjectAttributes.id);
        expect(id).toBe(newObjectAttributes.id);
        expect(await dbQueries.exists(newObjectAttributes.id)).toBe(false);

        const ids = await dbQueries.deleteMultiple([newObjectAttributes.id, newObjectAttributes2.id]);
        expect(ids).toEqual([newObjectAttributes2.id]);

    });

});
