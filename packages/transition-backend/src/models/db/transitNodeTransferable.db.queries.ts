/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { validate as uuidValidate } from 'uuid';

import { truncate, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import { TransferableNodes } from 'transition-common/lib/services/nodes/Node';

const tableName = 'tr_transit_node_transferable';

/**
 * Save the transferables nodes for a given node. The `transferableNodesFrom`
 * argument is mandatory as it contains the nodes transferable from the node in
 * argument. These will replace all transferable nodes for the node. If set, the
 * `transferableNodesTo` argument will replace all transferable nodes with the
 * node as destination. This argument can be set when a node's geography has
 * changed to update both transferable from and to the new node's location.
 *
 * @param nodeId The ID of the node those transferable nodes apply to
 * @param transferableNodesFrom The nodes that are transferable from the node ID
 * (the node is the origin)
 * @param transferableNodesTo The nodes that are transferable to the node ID
 * (the node is the destination)
 */
const saveForNode = async (
    nodeId: string,
    transferableNodesFrom: TransferableNodes,
    transferableNodesTo?: TransferableNodes
): Promise<void> => {
    try {
        if (!uuidValidate(nodeId)) {
            throw `Saving transferable nodes for node, invalid node ID ${nodeId}`;
        }
        const insertData = transferableNodesFrom.nodesIds
            .map((tn, idx) => ({
                origin_node_id: nodeId,
                destination_node_id: tn,
                walking_travel_time_seconds: transferableNodesFrom.walkingTravelTimesSeconds[idx],
                walking_travel_distance_meters: transferableNodesFrom.walkingDistancesMeters[idx]
            }))
            .filter((tn) => tn.origin_node_id !== tn.destination_node_id);
        const chunkSize = 250;

        const toData =
            transferableNodesTo === undefined
                ? []
                : transferableNodesTo.nodesIds.map((tn, idx) => ({
                    origin_node_id: tn,
                    destination_node_id: nodeId,
                    walking_travel_time_seconds: transferableNodesTo.walkingTravelTimesSeconds[idx],
                    walking_travel_distance_meters: transferableNodesTo.walkingDistancesMeters[idx]
                }));
        insertData.push(...toData);

        await knex.transaction(async (trx) => {
            // FIXME The onConflict for upsert does not work with batchInsert,
            // so we delete/add the nodes, instead of selectively deleting and
            // adding or updating existing. See if that has performance impact
            // and if selective delete/update/insert would be better

            // Delete nodes that are not transferable anymore
            const deleteQuery = knex(tableName).where('origin_node_id', nodeId);
            if (transferableNodesTo !== undefined) {
                deleteQuery.orWhere('destination_node_id', nodeId);
            }
            await deleteQuery.del().transacting(trx);
            // Add them again
            if (insertData.length > 0) {
                await knex.batchInsert(tableName, insertData, chunkSize).transacting(trx);
            }
        });
    } catch (error) {
        throw new TrError(
            `Cannot save transferable nodes for ${nodeId} (knex error: ${error})`,
            'DBTNSN0001',
            'CannotSaveTransferableNodesForBecauseDatabaseError'
        );
    }
};

/**
 * Get all transferable nodes from the node's location.
 *
 * @param nodeId The ID of the node for which to get the transferable nodes
 * @returns The transferable nodes' object. The first node is the node itself.
 */
const getFromNode = async (nodeId: string): Promise<TransferableNodes> => {
    try {
        if (!uuidValidate(nodeId)) {
            throw `Getting transferable nodes, invalid node ID ${nodeId}`;
        }

        const transferableNodesArr = await knex(tableName)
            .where('origin_node_id', nodeId)
            .orderBy('walking_travel_time_seconds');

        // Initialise transferable nodes, with the node itself
        const transferableNodesObj: TransferableNodes = {
            nodesIds: [nodeId],
            walkingTravelTimesSeconds: [0],
            walkingDistancesMeters: [0]
        };
        transferableNodesArr.forEach((nodeData) => {
            transferableNodesObj.nodesIds.push(nodeData.destination_node_id);
            transferableNodesObj.walkingTravelTimesSeconds.push(nodeData.walking_travel_time_seconds);
            transferableNodesObj.walkingDistancesMeters.push(nodeData.walking_travel_distance_meters);
        });

        return transferableNodesObj;
    } catch (error) {
        throw new TrError(
            `Cannot save transferable nodes for ${nodeId} (knex error: ${error})`,
            'DBTNSN0001',
            'CannotSaveTransferableNodesForBecauseDatabaseError'
        );
    }
};

/**
 * Get the ID of the nodes transferable to a given node
 * @param nodeId The destination node ID
 * @returns The array of node IDs with transfers to the node
 */
const getToNode = async (nodeId: string): Promise<string[]> => {
    try {
        if (!uuidValidate(nodeId)) {
            throw `Getting transferable nodes, invalid node ID ${nodeId}`;
        }

        const transferableNodesArr = await knex(tableName).where('destination_node_id', nodeId);

        return transferableNodesArr.map((node) => node.origin_node_id);
    } catch (error) {
        throw new TrError(
            `Cannot save transferable nodes for ${nodeId} (knex error: ${error})`,
            'DBTNSN0001',
            'CannotSaveTransferableNodesForBecauseDatabaseError'
        );
    }
};

export type TransferableNodePair = {
    from: { pathId: string; nodeId: string };
    to: { pathId: string; nodeId: string };
    walking_travel_time_seconds: number;
    walking_travel_distance_meters: number;
};
const getTransferableNodePairs = async ({
    pathsFrom,
    pathsTo
}: {
    pathsFrom: string[];
    pathsTo: string[];
}): Promise<TransferableNodePair[]> => {
    try {
        // Query to run:
        // WITH path_node AS (
        //     SELECT id, unnest(nodes) AS nid
        //     FROM demo_transition.tr_transit_paths
        //     WHERE id IN ('4d3bdbc3-645f-4dc1-87ff-0e75738327fe', '59abf1c4-29f1-477d-a6bc-f41571d044c6',
        //                  '0f3abf1f-06da-41a9-84e6-8ed9289abb4d', '18bc98f0-f291-40af-b1de-532f2592fd4f')
        // ),
        // ranked_transfers AS (
        //     SELECT
        //         pno.id AS origin_path_id,
        //         pnd.id AS destination_path_id,
        //         tn.*,
        //         ROW_NUMBER() OVER (
        //             PARTITION BY pno.id, pnd.id, tn.origin_node_id
        //             ORDER BY tn.walking_travel_distance_meters
        //         ) AS rn
        //     FROM demo_transition.tr_transit_node_transferable tn
        //     INNER JOIN path_node pno ON pno.nid = tn.origin_node_id
        //     INNER JOIN path_node pnd ON pnd.nid = tn.destination_node_id
        //     WHERE pno.id IN ('4d3bdbc3-645f-4dc1-87ff-0e75738327fe', '59abf1c4-29f1-477d-a6bc-f41571d044c6')
        //     AND pnd.id IN ('0f3abf1f-06da-41a9-84e6-8ed9289abb4d', '18bc98f0-f291-40af-b1de-532f2592fd4f')
        // )
        // SELECT
        //     origin_path_id,
        //     destination_path_id,
        //     origin_node_id,
        //     destination_node_id,
        //     walking_travel_time_seconds,
        //     walking_travel_distance_meters
        // FROM ranked_transfers
        // WHERE rn = 1;
        const withPathName = 'path_node';
        const withRankedNodesName = 'ranked_nodes';
        const transferableNodePairs = await knex
            .with(withPathName, (qb) => {
                qb.select('id', knex.raw('unnest(nodes) as nid'))
                    .from('tr_transit_paths')
                    .whereIn('id', [...pathsFrom, ...pathsTo]);
            })
            .with(withRankedNodesName, (qb) => {
                qb.select(
                    'pno.id as origin_path_id',
                    'pnd.id as destination_path_id',
                    'tn.*',
                    knex.raw(
                        'ROW_NUMBER() OVER (PARTITION BY pno.id, pnd.id, tn.origin_node_id ORDER BY tn.walking_travel_time_seconds) as rn'
                    )
                )
                    .from(`${tableName} as tn`)
                    .innerJoin(`${withPathName} as pno`, 'pno.nid', 'tn.origin_node_id')
                    .innerJoin(`${withPathName} as pnd`, 'pnd.nid', 'tn.destination_node_id')
                    .whereIn('pno.id', pathsFrom)
                    .whereIn('pnd.id', pathsTo);
            })
            .select('*')
            .from(withRankedNodesName)
            .where('rn', 1);
        return transferableNodePairs.map((pair) => {
            const { origin_path_id, destination_path_id, origin_node_id, destination_node_id, ...rest } = pair;
            return {
                from: { pathId: origin_path_id, nodeId: origin_node_id },
                to: { pathId: destination_path_id, nodeId: destination_node_id },
                ...rest
            };
        });
    } catch (error) {
        throw new TrError(
            `Cannot get transferable node pairs (knex error: ${error})`,
            'DBTNSN0002',
            'CannotGetTransferableNodePairsBecauseDatabaseError'
        );
    }
};

export default {
    saveForNode,
    getFromNode,
    getToNode,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    getTransferableNodePairs
};
