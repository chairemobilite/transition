/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash/cloneDeep';
import {
    exists,
    create,
    createMultiple,
    update,
    updateMultiple,
    deleteRecord,
    deleteMultiple,
    truncate,
    destroy
} from 'chaire-lib-backend/lib/models/db/default.db.queries';
import TrError from 'chaire-lib-common/lib/utils/TrError';
import Preferences from 'chaire-lib-common/lib/config/Preferences';
import { ServiceAttributes } from 'transition-common/lib/services/service/Service';
import { WithTransaction } from 'chaire-lib-backend/lib/models/db/types.db';

const tableName = 'tr_transit_services';

// TODO Type the return values
const attributesCleaner = function (attributes: Partial<ServiceAttributes>): { [key: string]: any } {
    const _attributes: any = _cloneDeep(attributes);
    delete _attributes.scheduled_lines;
    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: string;
    data: { [key: string]: unknown };
    [key: string]: unknown | null;
}): Partial<ServiceAttributes> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, data, ...rest } = dbAttributes;
    Object.keys(rest).forEach(
        (key) => (dbAttributes[key] = dbAttributes[key] !== null ? dbAttributes[key] : undefined)
    );
    return dbAttributes as unknown as ServiceAttributes;
};

const collection = async (options: { serviceIds?: string[] } & WithTransaction = {}) => {
    try {
        // TODO When the complete collection is not sent to the client directly, there should be a sort option to this method
        const query = knex
            .select(
                knex.raw(`s.*,
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
        ARRAY(SELECT TO_CHAR(UNNEST(only_dates), 'YYYY-MM-DD')) as only_dates,
        ARRAY(SELECT TO_CHAR(UNNEST(except_dates), 'YYYY-MM-DD')) as except_dates,
        COALESCE(color, '${Preferences.current.transit.services.defaultColor}') as color,
        array_remove(ARRAY_AGG(DISTINCT sched.line_id), null) as scheduled_lines`)
            )
            .from(`${tableName} as s`)
            .leftJoin('tr_transit_schedules as sched', 's.id', 'sched.service_id')
            .groupBy('s.id')
            .where('is_enabled', true)
            .orderBy('s.name');
        if (options.serviceIds) {
            query.whereIn('s.id', options.serviceIds);
        }
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const collection = await query;
        if (collection) {
            return collection.map(attributesParser);
        }
    } catch (error) {
        throw new TrError(
            `cannot fetch transit services collection because of a database error (knex error: ${error})`,
            'THQGC0002',
            'TransitServiceCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
    throw new TrError(
        'cannot fetch transit services collection because database did not return a valid array',
        'THQGC0001',
        'TransitServiceCollectionCouldNotBeFetchedBecauseDatabaseError'
    );
};

const read = async (id: string) => {
    try {
        const rows = await knex
            .select(
                knex.raw(`
        s.*,
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
        ARRAY(SELECT TO_CHAR(UNNEST(only_dates), 'YYYY-MM-DD')) as only_dates,
        ARRAY(SELECT TO_CHAR(UNNEST(except_dates), 'YYYY-MM-DD')) as except_dates,
        COALESCE(color, '${Preferences.current.transit.services.defaultColor}') as color,
        array_remove(ARRAY_AGG(DISTINCT sched.line_id), null) as scheduled_lines`)
            )
            .from(`${tableName} as s`)
            .leftJoin('tr_transit_schedules as sched', 's.id', 'sched.service_id')
            .where('s.id', id)
            .groupBy('s.id');
        if (rows && rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDPLC0002',
                'DatabaseCannotReadServiceBecauseObjectDoesNotExist'
            );
        }
        return attributesParser(rows[0]);
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'THQGC0002',
            'TransitServiceCannotReadBecauseDatabaseError'
        );
    }
};

/**
 * Get the names of the services starting with the given prefix
 *
 * @param servicePrefix The prefix to search for
 * @returns An array of service names
 */
const getServiceNamesStartingWith = async (servicePrefix: string, options: WithTransaction = {}): Promise<string[]> => {
    try {
        const query = knex.select('name').from(tableName).where('name', 'ilike', `${servicePrefix}%`);
        if (options.transaction) {
            query.transacting(options.transaction);
        }
        const response = await query;
        return response.map((service) => service.name);
    } catch (error) {
        throw new TrError(
            `Cannot fetch records with name starting with ${servicePrefix} from table ${tableName} (knex error: ${error})`,
            'THQGC0003',
            'TransitServiceNamesStartingWithCannotBeFetchedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: ServiceAttributes, options?: Parameters<typeof create>[4]) => {
        return create(knex, tableName, attributesCleaner, newObject, options);
    },
    createMultiple: (newObjects: ServiceAttributes[], options?: Parameters<typeof createMultiple>[4]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, options);
    },
    update: (id: string, updatedObject: Partial<ServiceAttributes>, options?: Parameters<typeof update>[5]) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, options);
    },
    updateMultiple: (updatedObjects: Partial<ServiceAttributes>[], options?: Parameters<typeof updateMultiple>[4]) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, options);
    },
    delete: async (id: string, options?: Parameters<typeof deleteRecord>[3]) =>
        deleteRecord(knex, tableName, id, options),
    deleteMultiple: async (ids: string[], options?: Parameters<typeof deleteMultiple>[3]) =>
        deleteMultiple(knex, tableName, ids, options),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    getServiceNamesStartingWith
};
