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
            .toThrow(expect.anything());
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
            .toThrow(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);

        // Invalid number for travel time
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, 'not a uuid'],
                walkingTravelTimesSeconds: [0, 'NaN' as any],
                walkingDistancesMeters: [0, 150]
            }))
            .rejects
            .toThrow(expect.anything());
        expect(await dbQueries.getFromNode(nodeAttributes[0].id)).toEqual(transferableNodesForUpdate);

        // Invalid number for distance
        await expect(dbQueries.saveForNode(nodeAttributes[0].id, {
                nodesIds: [nodeAttributes[0].id, 'not a uuid'],
                walkingTravelTimesSeconds: [0, 100],
                walkingDistancesMeters: [0, 'NaN' as any]
            }))
            .rejects
            .toThrow(expect.anything());
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