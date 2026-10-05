/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import { Knex } from 'knex';
import _cloneDeep from 'lodash/cloneDeep';
import { validate as uuidValidate } from 'uuid';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';
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
import {
    createDuplicateQueryWithIdMapping,
    getIdMappingQuery,
    getIdSelectionQuery,
    getQueryFilters,
    joinWithClauses,
    mapDuplicateIds
} from './utils.db.queries';

const tableName = 'tr_transit_lines';
const joinedTable = 'tr_transit_paths';
const joinedScheduleTable = 'tr_transit_schedules';

const attributesCleaner = function (attributes: Partial<LineAttributes>): Partial<LineAttributes> {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.path_ids;
    delete _attributes.service_ids;
    delete _attributes.scheduleByServiceId;
    // Let the db handle this field, it is used mostly for this purpose. We don't want to initialize to null if undefined
    if (_attributes.integer_id === undefined) {
        delete _attributes.integer_id;
    }
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

/**
 * Duplicate lines, possibly for a specific agency mapping for agencies.
 * Either an array of lines, or an agencyMapping must be specified.
 *
 * @param param The parameter object
 * @param param.lineIds The lines IDs to duplicate
 * @param param.agencyIdMapping The mapping of original line IDs to new line IDs
 * @param newObjectsSuffix The suffix to append to the line's longname
 * @param param.transaction The transaction to use for the duplication, if any
 * @returns A mapping of the ID of the lines copied to the ID of the copy.
 */
const duplicate = async ({
    lineIds: requestedLineIds = [],
    agencyIdMapping = {},
    newLineSuffix = '',
    transaction
}: {
    lineIds?: string[];
    agencyIdMapping?: { [originalAgencyId: string]: string };
    newLineSuffix?: string;
    transaction?: Knex.Transaction;
}): Promise<{ [originalLineId: string]: string }> => {
    const lineIds = [...new Set(requestedLineIds)];
    try {
        // Deduplicate line ids, in case a line is requested twice
        if (lineIds.length === 0 && Object.keys(agencyIdMapping).length === 0) {
            throw new Error('There needs to be either line IDs or an agency mapping to duplicate lines.');
        }
        // Validate that mappings and arrays are all uuids
        lineIds.forEach((lineId) => {
            if (!uuidValidate(lineId)) {
                throw new Error('Line IDs must be valid uuids');
            }
        });
        Object.entries(agencyIdMapping).forEach(([originalId, mappedId]) => {
            if (!uuidValidate(originalId) || !uuidValidate(mappedId)) {
                throw new Error('Agency mappings must be valid uuids');
            }
        });

        const agencyMappingQuery = getIdMappingQuery(agencyIdMapping, 'agency', tableName);
        const lineSelectionQuery = getIdSelectionQuery(lineIds, tableName);

        // These queries are inspired by both
        // https://stackoverflow.com/questions/29256888/insert-into-from-select-returning-id-mappings
        // and
        // https://dba.stackexchange.com/questions/46410/how-do-i-insert-a-row-which-contains-a-foreign-key
        // so that a single query can copy for many agencies and lines ids

        // Query to copy the requested lines for the requested agencies if any.
        // Using raw as it is complex to put in knex
        const lineName = _isBlank(newLineSuffix) ? 'longname' : 'longname || ?';
        const withClauses = joinWithClauses([agencyMappingQuery, lineSelectionQuery]);
        const duplicateLinesQuery = `${withClauses.query} \
            insert into ${tableName}(internal_id, mode, category, agency_id, shortname, longname, color, is_autonomous, allow_same_line_transfers, is_enabled, description, data, is_frozen) \
                select internal_id, mode, category, ${agencyMappingQuery.mappedField}, shortname, ${lineName}, color, is_autonomous, allow_same_line_transfers, is_enabled, description, data, is_frozen
                from ${tableName} \
                ${agencyMappingQuery.mappedJoin} \
                ${lineSelectionQuery.mappedJoin} \
                order by integer_id returning id, integer_id`;

        // Put the where queries and bindings for lines and services in arrays to better join them if necessary in the query
        const lineWhereQueries = getQueryFilters([agencyMappingQuery, lineSelectionQuery]);

        const rawQuery = knex.raw(
            createDuplicateQueryWithIdMapping(
                tableName,
                duplicateLinesQuery,
                lineWhereQueries.whereClauses.join(' and '),
                'integer_id'
            ),
            [...lineWhereQueries.bindings, ...withClauses.bindings, ...(_isBlank(newLineSuffix) ? [] : [newLineSuffix])]
        );

        if (transaction) {
            rawQuery.transacting(transaction);
        }
        const lineIdMapping = await rawQuery;

        if (lineIdMapping.rows.length === 0) {
            return {};
        }

        return mapDuplicateIds<string>(lineIdMapping.rows);
    } catch (error) {
        throw new TrError(
            `Cannot duplicate lines for agencies ${JSON.stringify(agencyIdMapping)} and line ids ${lineIds} in database (knex error: ${error})`,
            'DBLINE0003',
            'TransitLineCannotBeDuplicatedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read,
    create: async (newObject: LineAttributes, options?: Parameters<typeof create>[4]) =>
        create(knex, tableName, attributesCleaner, newObject, options),
    // TODO Create multiple will have to handle schedules too or do we suppose it's only the line attributes?
    createMultiple: async (newObjects: LineAttributes[], options?: Parameters<typeof createMultiple>[4]) =>
        createMultiple(knex, tableName, attributesCleaner, newObjects, options),
    update: async (id: string, updatedObject: Partial<LineAttributes>, options?: Parameters<typeof update>[5]) =>
        update(knex, tableName, attributesCleaner, id, updatedObject, options),
    // TODO Update multiple will have to handle schedules too or do we suppose it's only the line attributes?
    updateMultiple: async (updatedObjects: Partial<LineAttributes>[], options?: Parameters<typeof updateMultiple>[4]) =>
        updateMultiple(knex, tableName, attributesCleaner, updatedObjects, options),
    delete: async (id: string, options?: Parameters<typeof deleteRecord>[3]) =>
        deleteRecord(knex, tableName, id, options),
    deleteMultiple: async (ids: string[], options?: Parameters<typeof deleteMultiple>[3]) =>
        deleteMultiple(knex, tableName, ids, options),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    // TODO Should collection also return the schedules?
    collection,
    collectionWithSchedules,
    duplicate
};
