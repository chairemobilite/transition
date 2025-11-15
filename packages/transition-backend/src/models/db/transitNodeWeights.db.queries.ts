/*
 * Copyright 2025, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { Knex } from 'knex';

import { truncate, destroy } from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';

import { TransitNodeWeightAttributes } from 'transition-common/lib/services/weights/TransitNodeWeight';

const tableName = 'tr_transit_node_weights';

const exists = async (
    weightDataSourceId: number,
    transitNodeId: string,
    options: { transaction?: Knex.Transaction } = {}
): Promise<boolean> => {
    try {
        const query = knex(tableName)
            .count('*')
            .where('weight_data_source_id', weightDataSourceId)
            .where('transit_node_id', transitNodeId);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const rows = await query;

        const count = rows.length > 0 ? rows[0].count : 0;
        if (count) {
            return (typeof count === 'string' ? parseInt(count) : count) >= 1;
        } else {
            throw new TrError(
                `Cannot verify if the object exists in ${tableName} (knex did not return a count)`,
                'DBTNW0001',
                'DatabaseCannotVerifyIfObjectExistsBecauseDatabaseError'
            );
        }
    } catch (error) {
        throw new TrError(
            `Cannot verify if the object exists in ${tableName} (knex error: ${error})`,
            'DBTNW0002',
            'DatabaseCannotVerifyIfObjectExistsBecauseDatabaseError'
        );
    }
};

const read = async (
    weightDataSourceId: number,
    transitNodeId: string,
    options: { transaction?: Knex.Transaction } = {}
): Promise<TransitNodeWeightAttributes> => {
    try {
        const query = knex(tableName)
            .select('*')
            .where('weight_data_source_id', weightDataSourceId)
            .where('transit_node_id', transitNodeId);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const rows = await query;

        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with weight_data_source_id ${weightDataSourceId} and transit_node_id ${transitNodeId} from table ${tableName}`,
                'DBTNW0003',
                'DatabaseCannotReadBecauseObjectDoesNotExist'
            );
        } else {
            return rows[0];
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object from table ${tableName} (knex error: ${error})`,
            'DBTNW0004',
            'DatabaseCannotReadBecauseDatabaseError'
        );
    }
};

const create = async (
    newObject: TransitNodeWeightAttributes,
    options: { transaction?: Knex.Transaction } = {}
): Promise<{ weight_data_source_id: number; transit_node_id: string }> => {
    try {
        const query = knex(tableName).insert(newObject);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return {
            weight_data_source_id: newObject.weight_data_source_id,
            transit_node_id: newObject.transit_node_id
        };
    } catch (error) {
        throw new TrError(
            `Cannot insert object in table ${tableName} (knex error: ${error})`,
            'DBTNW0005',
            'DatabaseCannotCreateBecauseDatabaseError'
        );
    }
};

const createMultiple = async (
    newObjects: TransitNodeWeightAttributes[],
    options: { transaction?: Knex.Transaction } = {}
): Promise<Array<{ weight_data_source_id: number; transit_node_id: string }>> => {
    try {
        const query = knex(tableName).insert(newObjects);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return newObjects.map((obj) => ({
            weight_data_source_id: obj.weight_data_source_id,
            transit_node_id: obj.transit_node_id
        }));
    } catch (error) {
        throw new TrError(
            `Cannot insert multiple objects in table ${tableName} (knex error: ${error})`,
            'DBTNW0006',
            'DatabaseCannotCreateMultipleBecauseDatabaseError'
        );
    }
};

const update = async (
    weightDataSourceId: number,
    transitNodeId: string,
    updatedObject: Partial<Pick<TransitNodeWeightAttributes, 'weight_value'>>,
    options: { transaction?: Knex.Transaction } = {}
): Promise<{ weight_data_source_id: number; transit_node_id: string }> => {
    try {
        const query = knex(tableName)
            .update(updatedObject)
            .where('weight_data_source_id', weightDataSourceId)
            .where('transit_node_id', transitNodeId);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return {
            weight_data_source_id: weightDataSourceId,
            transit_node_id: transitNodeId
        };
    } catch (error) {
        throw new TrError(
            `Cannot update object in table ${tableName} (knex error: ${error})`,
            'DBTNW0007',
            'DatabaseCannotUpdateBecauseDatabaseError'
        );
    }
};

const deleteRecord = async (
    weightDataSourceId: number,
    transitNodeId: string,
    options: { transaction?: Knex.Transaction } = {}
): Promise<{ weight_data_source_id: number; transit_node_id: string }> => {
    try {
        const query = knex(tableName)
            .where('weight_data_source_id', weightDataSourceId)
            .where('transit_node_id', transitNodeId)
            .del();
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query;
        return {
            weight_data_source_id: weightDataSourceId,
            transit_node_id: transitNodeId
        };
    } catch (error) {
        throw new TrError(
            `Cannot delete object from table ${tableName} (knex error: ${error})`,
            'DBTNW0008',
            'DatabaseCannotDeleteBecauseDatabaseError'
        );
    }
};

const deleteMultiple = async (
    pairs: Array<{ weight_data_source_id: number; transit_node_id: string }>,
    options: { transaction?: Knex.Transaction } = {}
): Promise<Array<{ weight_data_source_id: number; transit_node_id: string }>> => {
    try {
        if (pairs.length === 0) {
            return [];
        }
        const query = knex(tableName).where((builder) => {
            pairs.forEach((pair, index) => {
                if (index === 0) {
                    builder
                        .where('weight_data_source_id', pair.weight_data_source_id)
                        .where('transit_node_id', pair.transit_node_id);
                } else {
                    builder.orWhere((b) =>
                        b
                            .where('weight_data_source_id', pair.weight_data_source_id)
                            .where('transit_node_id', pair.transit_node_id)
                    );
                }
            });
        });
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        await query.del();
        return pairs;
    } catch (error) {
        throw new TrError(
            `Cannot delete multiple objects from table ${tableName} (knex error: ${error})`,
            'DBTNW0009',
            'DatabaseCannotDeleteMultipleBecauseDatabaseError'
        );
    }
};

const collection = async (
    weightDataSourceId?: number,
    transitNodeId?: string
): Promise<TransitNodeWeightAttributes[]> => {
    try {
        const query = knex(tableName).select('*');
        if (weightDataSourceId !== undefined) {
            query.where('weight_data_source_id', weightDataSourceId);
        }
        if (transitNodeId !== undefined) {
            query.where('transit_node_id', transitNodeId);
        }
        return await query;
    } catch (error) {
        throw new TrError(
            `cannot fetch transit node weights collection because of a database error (knex error: ${error})`,
            'DBTNW0010',
            'TransitNodeWeightsCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

export default {
    exists,
    read,
    create,
    createMultiple,
    update,
    delete: deleteRecord,
    deleteMultiple,
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
