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

const collection = async () => {
    try {
        // TODO When the complete collection is not sent to the client directly, there should be a sort option to this method
        const response = await knex.raw(
            `
      SELECT 
        s.*,
        TO_CHAR(start_date, 'YYYY-MM-DD') as start_date,
        TO_CHAR(end_date, 'YYYY-MM-DD') as end_date,
        ARRAY(SELECT TO_CHAR(UNNEST(only_dates), 'YYYY-MM-DD')) as only_dates,
        ARRAY(SELECT TO_CHAR(UNNEST(except_dates), 'YYYY-MM-DD')) as except_dates,
        COALESCE(color, '${Preferences.current.transit.services.defaultColor}') as color,
        array_remove(ARRAY_AGG(DISTINCT sched.line_id), null) as scheduled_lines
      FROM tr_transit_services as s
      LEFT JOIN tr_transit_schedules sched ON s.id = sched.service_id
      WHERE is_enabled IS TRUE
      GROUP BY s.id
      ORDER BY s.name;
    `
        );
        const collection = response.rows;
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

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: ServiceAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, { returning });
    },
    createMultiple: (newObjects: ServiceAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, { returning });
    },
    update: (id: string, updatedObject: Partial<ServiceAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, { returning });
    },
    updateMultiple: (updatedObjects: Partial<ServiceAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, { returning });
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection
};
