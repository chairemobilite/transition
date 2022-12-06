/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash.clonedeep';
import { validate as uuidValidate } from 'uuid';
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
import Line, { LineAttributes } from 'transition-common/lib/services/line/Line';
import { ScheduleAttributes } from 'transition-common/lib/services/schedules/Schedule';

import scheduleQueries from './transitSchedules.db.queries';

const tableName = 'tr_transit_lines';
const joinedTable = 'tr_transit_paths';
const joinedScheduleTable = 'tr_transit_schedules';

const attributesCleaner = function (attributes: Partial<LineAttributes>): Partial<LineAttributes> {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.path_ids;
    delete _attributes.service_ids;
    delete _attributes.scheduleByServiceId;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, created_at, updated_at, ...rest } = _attributes;
    Object.keys(rest).forEach((key) => (_attributes[key] = attributes[key] !== undefined ? attributes[key] : null));
    return _attributes;
};

const attributesParser = (dbAttributes: {
    id: string;
    data: { [key: string]: unknown };
    [key: string]: unknown | null;
}): Partial<LineAttributes> => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, data, ...rest } = dbAttributes;
    Object.keys(rest).forEach(
        (key) => (dbAttributes[key] = dbAttributes[key] !== null ? dbAttributes[key] : undefined)
    );
    return dbAttributes as unknown as LineAttributes;
};

const collection = async (lineIds?: string[]) => {
    try {
        // TODO There used to be a order by p.integer_id for path order, but
        // this query as is won't work with the distinct, which is required
        // since service ids was added to the query. The path refresh should
        // rather be done by getting a collection from the DB, with the paths
        // ordered instead of depending on this array field which should just be
        // informative on the path count.
        // TODO Return the count instead of the array of path and service ids?
        const query = knex(`${tableName} as l`)
            .leftJoin(`${joinedTable} as p`, function () {
                this.on('l.id', 'p.line_id');
            })
            .leftJoin(`${joinedScheduleTable} as sched`, 'l.id', 'sched.line_id')
            .select(
                knex.raw(`
      l.*,
      COALESCE(l.color, '${Preferences.current.transit.lines.defaultColor}') as color,
      array_remove(array_agg(distinct p.id), NULL) AS path_ids,
      array_remove(array_agg(distinct sched.service_id), NULL) AS service_ids
    `)
            )
            .where('l.is_enabled', 'TRUE');
        if (lineIds !== undefined) {
            query.whereIn('l.id', lineIds);
        }
        const collection = await query.groupByRaw('l.id').orderByRaw('LPAD(l.shortname, 20, \'0\'), l.id');
        if (collection) {
            return collection.map(attributesParser);
        }
        throw new TrError(
            'cannot fetch transit lines collection because database did not return a valid array',
            'TLQGC0001',
            'TransitLineCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit lines collection because of a database error (knex error: ${error})`,
            'TLQGC0002',
            'TransitLineCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

const collectionWithSchedules = async (lines: Line[]): Promise<Line[]> => {
    const scheduleCollection = await scheduleQueries.readForLines(lines.map((line) => line.getId()));
    // Prepare schedule collection for easy assignation
    const schedulesByLine: { [key: string]: { [key: string]: ScheduleAttributes } } = {};
    scheduleCollection.forEach((schedule) => {
        const schedulesForLine = schedulesByLine[schedule.line_id] || {};
        // When coming from the DB, the service ID will always be defined
        schedulesForLine[schedule.service_id as string] = schedule;
        schedulesByLine[schedule.line_id] = schedulesForLine;
    });
    // Assign schedules by service IDs to lines
    lines.forEach((line) => {
        if (schedulesByLine[line.id]) {
            line.attributes.scheduleByServiceId = schedulesByLine[line.id];
        } else {
            line.attributes.scheduleByServiceId = {};
        }
    });
    return lines;
};

const read = async (id: string) => {
    try {
        if (!uuidValidate(id)) {
            throw new TrError(
                `Cannot read object from table ${tableName} because the required parameter id is missing, blank or not a valid uuid`,
                'DBQRDL0001',
                'DatabaseCannotReadTransitLineBecauseIdIsMissingOrInvalid'
            );
        }
        const response = await knex.raw(
            `
      SELECT 
        l.*,
        COALESCE(l.color, '${Preferences.current.transit.lines.defaultColor}') as color,
        array_remove(array_agg(p.id ORDER BY p.integer_id), NULL) AS path_ids
      FROM tr_transit_lines l
      LEFT JOIN tr_transit_paths p ON p.line_id = l.id
      WHERE l.id = '${id}'
      GROUP BY l.id;
    `
        );
        const rows = response.rows;
        if (rows.length !== 1) {
            throw new TrError(
                `Cannot find object with id ${id} from table ${tableName}`,
                'DBQRDL0002',
                'DatabaseCannotReadTransitLineBecauseObjectDoesNotExist'
            );
        } else {
            const line = rows[0];
            line.scheduleByServiceId = {};
            try {
                const schedules = await scheduleQueries.readForLine(id);
                schedules.forEach((schedule) => (line.scheduleByServiceId[schedule.service_id as string] = schedule));
            } catch (error) {
                console.error(`Error fetching schedules for line ${line.id}: ${error} `);
            }
            return attributesParser(line);
        }
    } catch (error) {
        throw new TrError(
            `Cannot read object with id ${id} from table ${tableName} (knex error: ${error})`,
            'DBQRDL0003',
            'DatabaseCannotReadTransitLineBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: (newObject: LineAttributes, returning?: string) => {
        return create(knex, tableName, attributesCleaner, newObject, returning);
    },
    // TODO Create multiple will have to handle schedules too or do we suppose it's only the line attributes?
    createMultiple: (newObjects: LineAttributes[], returning?: string[]) => {
        return createMultiple(knex, tableName, attributesCleaner, newObjects, returning);
    },
    update: (id: string, updatedObject: Partial<LineAttributes>, returning?: string) => {
        return update(knex, tableName, attributesCleaner, id, updatedObject, returning);
    },
    // TODO Update multiple will have to handle schedules too or do we suppose it's only the line attributes?
    updateMultiple: (updatedObjects: Partial<LineAttributes>[], returning?: string) => {
        return updateMultiple(knex, tableName, attributesCleaner, updatedObjects, returning);
    },
    delete: deleteRecord.bind(null, knex, tableName),
    deleteMultiple: deleteMultiple.bind(null, knex, tableName),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    // TODO Should collection also return the schedules?
    collection,
    collectionWithSchedules
};
