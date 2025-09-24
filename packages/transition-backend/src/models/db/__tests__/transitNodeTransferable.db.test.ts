/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { v4 as uuidV4 } from 'uuid';
import knex from 'chaire-lib-backend/lib/config/shared/db.config';

import dbQueries from '../transitNodeTransferable.db.queries';
import nodesDbQueries from '../transitNodes.db.queries';
import pathDbQueries from '../transitPaths.db.queries';
import linesDbQueries from '../transitLines.db.queries';
import agencyDbQueries from '../transitAgencies.db.queries'

const objectName = 'transferable node';

const nodeAttributes = [0, 1, 2, 3, 4, 5].map(idx => ({
    id: uuidV4(),
    code: `000${idx}`,
    name: `NewNode ${idx}`,
    internal_id: `Test${idx}`,
    integer_id: idx,
    geography: {
        type: "Point" as const,
        coordinates: [-73 + 0.001 * idx, 45 + 0.001 * idx]
    },
    color: '#ffff00',
    is_enabled: true,
    is_frozen: false,
    description: `New node description ${idx}`,
    default_dwell_time_seconds: 25,
    routing_radius_meters: 50,
    data: {
        foo: 'bar'
    }
}))

beforeAll(async () => {
    jest.setTimeout(10000);
    await dbQueries.truncate();
    await nodesDbQueries.truncate();
    await nodesDbQueries.createMultiple(nodeAttributes);
});

afterAll(async () => {
    await dbQueries.truncate();
    await agencyDbQueries.truncate();
    await nodesDbQueries.truncate();
    await knex.destroy();
});

describe(`${objectName}`, () => {

    // Arbitrary transferable nodes for the initial insert
    const transferableNodesInitial = {
        nodesIds: [nodeAttributes[0].id, nodeAttributes[1].id, nodeAttributes[2].id, nodeAttributes[3].id],
        walkingTravelTimesSeconds: [0, 100, 200, 300],
        walkingDistancesMeters: [0, 150, 300, 450]
    }

    // Arbitrary transferable nodes for the update, with some common nodes
    const transferableNodesForUpdate = {
        nodesIds: [nodeAttributes[0].id, nodeAttributes[4].id, nodeAttributes[1].id, nodeAttributes[5].id],
        walkingTravelTimesSeconds: [0, 100, 200, 300],
        walkingDistancesMeters: [0, 150, 300, 450]
    }

    const tranferableNodesForSecondNode = {
        nodesIds: [nodeAttributes[1].id, nodeAttributes[0].id, nodeAttributes[2].id],
        walkingTravelTimesSeconds: [0, 100, 200],
        walkingDistancesMeters: [0, 150, 300]
    }

    test('Add new transferable nodes for a single node', async () => {
        await dbQueries.saveForNode(nodeAttributes[0].id, transferableNodesInitial);
    });

    test('Get transferable nodes for single node', async () => {
        const transferableNodes = await dbQueries.getFromNode(nodeAttributes[0].id);
        expect(transferableNodes).toEqual(transferableNodesInitial);
    });

    test('Update transferable nodes for a single node', async () => {
        await dbQueries.saveForNode(nodeAttributes[0].id, transferableNodesForUpdate);
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);
    });

    test('Insert unexisting nodes, make sure no change was done', async () => {
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, uuidV4()],
                walkingTravelTimesSeconds: [0, 100],
                walkingDistancesMeters: [0, 150]
            }))
            .rejects
            .toThrowError(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);
    });

    test('Insert with invalid data types, no change expected', async () => {
        // Invalid uuid
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, 'not a uuid'],
                walkingTravelTimesSeconds: [0, 100],
                walkingDistancesMeters: [0, 150]
            }))
            .rejects
            .toThrowError(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);

        // Invalid number for travel time
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, 'not a uuid'],
                walkingTravelTimesSeconds: [0, 'NaN' as any],
                walkingDistancesMeters: [0, 150]
            }))
            .rejects
            .toThrowError(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);

        // Invalid number for distance
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, 'not a uuid'],
                walkingTravelTimesSeconds: [0, 100],
                walkingDistancesMeters: [0, 'NaN' as any]
            }))
            .rejects
            .toThrowError(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);
    });

    test('Get for nodes without transferable nodes', async () => {
        const transferableNodes = await dbQueries.getFromNode(nodeAttributes[1].id);
        expect(transferableNodes).toEqual({ 
            nodesIds: [nodeAttributes[1].id], 
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        });
    });

    test('Get for node not in database, should be the node itself', async () => {
        const unexistingNodeId = uuidV4();
        const transferableNodes = await dbQueries.getFromNode(unexistingNodeId);
        expect(transferableNodes).toEqual({ 
            nodesIds: [unexistingNodeId], 
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        });
    });

    test('Add transferable nodes for second node', async() => {
        await dbQueries.saveForNode(nodeAttributes[1].id, tranferableNodesForSecondNode);
    });

    test('Update transferable nodes with destination nodes', async() => {
        // Bring back initial data for node[0] and add nodes with destination
        await dbQueries.saveForNode(nodeAttributes[0].id, transferableNodesInitial, {
            nodesIds: [nodeAttributes[1].id, nodeAttributes[2].id], 
            walkingTravelTimesSeconds: [300, 600],
            walkingDistancesMeters: [400, 800]
        });

        // node[0] should be initial node's data
        const transferableNodesFrom0 = await dbQueries.getFromNode(nodeAttributes[0].id);
        expect(transferableNodesFrom0).toEqual(transferableNodesInitial);

        // node[1] should have updated value for node[0], and still have node[2]
        const transferableNodesFrom1 = await dbQueries.getFromNode(nodeAttributes[1].id);
        expect(transferableNodesFrom1).toEqual({
            nodesIds: [nodeAttributes[1].id, nodeAttributes[2].id, nodeAttributes[0].id], 
            walkingTravelTimesSeconds: [0, 200, 300],
            walkingDistancesMeters: [0, 300, 400]
        });

        // node[2] should have node[0]
        const transferableNodesFrom2 = await dbQueries.getFromNode(nodeAttributes[2].id);
        expect(transferableNodesFrom2).toEqual({
            nodesIds: [nodeAttributes[2].id, nodeAttributes[0].id], 
            walkingTravelTimesSeconds: [0, 600],
            walkingDistancesMeters: [0, 800]
        });
    });

    test('Get nodes to destination, has transferable nodes', async () => {
        const transferableNodes = await dbQueries.getToNode(nodeAttributes[0].id);
        expect(transferableNodes).toEqual([nodeAttributes[1].id, nodeAttributes[2].id]);
    });

    test('Get nodes to destination, node not in database', async () => {
        const transferableNodes = await dbQueries.getToNode(uuidV4());
        expect(transferableNodes).toEqual([]);
    });
    
});

describe('getTransferableNodePairs', () => {
    // Make another line of nodes
    const otherNodeAttributes = [0, 1, 2, 3, 4, 5].map(idx => ({
        id: uuidV4(),
        code: `000${idx + 10}`,
        name: `NewNode ${idx + 10}`,
        internal_id: `Test${idx + 10}`,
        integer_id: idx + 10,
        geography: {
            type: "Point" as const,
            coordinates: [-72.995 - 0.001 * idx, 45 + 0.001 * idx]
        },
        color: '#ffff00',
        is_enabled: true,
        is_frozen: false,
        description: `New node description ${idx}`,
        default_dwell_time_seconds: 25,
        routing_radius_meters: 50,
        data: {
            foo: 'bar'
        }
    }));
    const agencyId = uuidV4();
    const lineIds = [uuidV4(), uuidV4()];
    const pathIds = [uuidV4(), uuidV4(), uuidV4(), uuidV4()];
    const pathNodes = [
        // Path stops at each node
        nodeAttributes.map(node => node.id),
        // Path stops at nodes with even indexes
        nodeAttributes.filter((node, idx) => idx % 2 === 0).map(node => node.id),
        // Path stops at each other node node
        otherNodeAttributes.map(node => node.id),
        // Path stops at other nodes with even indexes
        otherNodeAttributes.filter((node, idx) => idx % 2 === 0).map(node => node.id)
    ]
    beforeAll(async () => {
        await dbQueries.truncate();
        // This should delete also lines and paths
        await agencyDbQueries.truncate();
        await nodesDbQueries.truncate();
        await nodesDbQueries.createMultiple([...nodeAttributes, ...otherNodeAttributes]);
        // Create an agency, 2 lines and 4 paths
        await agencyDbQueries.create({
            id: agencyId,
            name: 'test',
            acronym: 'test'
        } as any);
        await linesDbQueries.createMultiple([{
            id: lineIds[0],
            shortname: 'test1',
            agency_id: agencyId,
            color: '#ffffff',
        }, {
            id: lineIds[1],
            shortname: 'test2',
            agency_id: agencyId,
            color: '#ffffff',
        }] as any);
        await pathDbQueries.createMultiple([{
            id: pathIds[0],// Path stops at each other node node
            line_id: lineIds[0],
            nodes: pathNodes[0],
        }, {
            id: pathIds[1],
            line_id: lineIds[0],
            nodes: pathNodes[1],
        }, {
            id: pathIds[2],
            line_id: lineIds[1],
            nodes: pathNodes[2],
        }, {
            id: pathIds[3],
            line_id: lineIds[1],
            nodes: pathNodes[3],
        }] as any);

        // For each node in nodeAttributes and otherNodeAttributes, fake some
        // transferable nodes data, the real number does not matter,
        // even-indexed nodes from the 2 series are not tranferrable
        for (let i = 0; i < nodeAttributes.length; i++) {
            const node = nodeAttributes[i];
            // Ignore the node itself from the array, and add transfers from the other series, ignoring even if the current index is even
            const transferableNodeIds = [...nodeAttributes.filter((n, idx) => idx !== i).map(n => n.id), ...otherNodeAttributes.filter((n, idx) => i % 2 !== 0 || idx % 2 !== 0).map(n => n.id)];
            await dbQueries.saveForNode(node.id, {
                nodesIds: transferableNodeIds,
                walkingTravelTimesSeconds: transferableNodeIds.map((id, idx) => (100 + i) * idx),
                walkingDistancesMeters: transferableNodeIds.map((id, idx) => (150 + i) * idx),
            });
        }
        for (let i = 0; i < otherNodeAttributes.length; i++) {
            const node = otherNodeAttributes[i];
            // Ignore the node itself from the array, and add transfers from the other series, ignoring even if the current index is even
            const transferableNodeIds = [...otherNodeAttributes.filter((n, idx) => idx !== i).map(n => n.id), ...nodeAttributes.filter((n, idx) => i % 2 !== 0 || idx % 2 !== 0).map(n => n.id)];
            await dbQueries.saveForNode(node.id, {
                nodesIds: transferableNodeIds,
                walkingTravelTimesSeconds: transferableNodeIds.map((id, idx) => (120 + i) * idx),
                walkingDistancesMeters: transferableNodeIds.map((id, idx) => (180 + i) * idx),
            });
        }
    });

    afterAll(async () => {
        await dbQueries.truncate();
        // This should delete also lines and paths
        await agencyDbQueries.truncate();
        await nodesDbQueries.truncate();
    });

    test('From/to paths no in database', async () => {
        expect(await dbQueries.getTransferableNodePairs({
            pathsFrom: [uuidV4(), uuidV4()],
            pathsTo: [uuidV4()]
        })).toEqual([]);
    });

    test('No transferable nodes between paths', async () => {
        expect(await dbQueries.getTransferableNodePairs({
            pathsFrom: [pathIds[1]],
            pathsTo: [pathIds[3]]
        })).toEqual([]);
    });

    test('Transferable nodes between paths', async () => {
        const transferrableNodes = await dbQueries.getTransferableNodePairs({
            pathsFrom: [pathIds[0]],
            pathsTo: [pathIds[2]]
        });
        // There should be one transferable node per node of the path
        expect(transferrableNodes.length).toEqual(pathNodes[0].length);

        // Make sure there are no duplicate entries for 2 paths and a node
        const noDuplicates1 = new Set(transferrableNodes.map(pair => `${pair.from.pathId}-${pair.from.nodeId}-${pair.to.pathId}`));
        expect(noDuplicates1.size).toBe(transferrableNodes.length);
        
        // pathIds[1] has less node, so there should be less transferable nodes
        const transferrableNodesLess = await dbQueries.getTransferableNodePairs({
            pathsFrom: [pathIds[1]],
            pathsTo: [pathIds[2]]
        })
        expect(transferrableNodesLess.length).toEqual(pathNodes[1].length);

        const noDuplicates2 = new Set(transferrableNodes.map(pair => `${pair.from.pathId}-${pair.from.nodeId}-${pair.to.pathId}`));
        expect(noDuplicates2.size).toBe(transferrableNodes.length);
    });

    test('Transferable nodes between multiple paths', async () => {
        const transferrableNodes = await dbQueries.getTransferableNodePairs({
            pathsFrom: [pathIds[0], pathIds[1]],
            pathsTo: [pathIds[2], pathIds[3]]
        });
        // pathIds[1] and pathIds[3] have no transferable nodes, and some nodes of pathIds[0] don't transfer with some nodes of pathIds[3]
        expect(transferrableNodes.length).toEqual(pathNodes[0].length + pathNodes[1].length + pathNodes[3].length);

        // Make sure there are no duplicate entries for 2 paths and a node
        const noDuplicates1 = new Set(transferrableNodes.map(pair => `${pair.from.pathId}-${pair.from.nodeId}-${pair.to.pathId}`));
        expect(noDuplicates1.size).toBe(transferrableNodes.length);
    });

    test('Invalid path ids', async () => {
        await expect(dbQueries.getTransferableNodePairs({
            pathsFrom: ['not a uuid'],
            pathsTo: ['not a uuid again']
        })).rejects.toThrow(expect.anything());
    });
});