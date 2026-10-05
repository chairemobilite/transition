/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from 'chaire-lib-backend/lib/config/shared/db.config';
import _cloneDeep from 'lodash/cloneDeep';
import { Knex } from 'knex';
import { validate as uuidValidate } from 'uuid';
import { _isBlank } from 'chaire-lib-common/lib/utils/LodashExtensions';

import {
    exists,
    read,
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
import {
    createDuplicateQueryWithIdMapping,
    getIdSelectionQuery,
    getQueryFilters,
    joinWithClauses,
    mapDuplicateIds
} from './utils.db.queries';

import { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';

const tableName = 'tr_transit_agencies';

const attributesCleaner = function (attributes: Partial<AgencyAttributes>): Partial<AgencyAttributes> {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.line_ids;
    delete _attributes.unit_ids;
    delete _attributes.garage_ids;
    return _attributes;
};

const collection = async (): Promise<AgencyAttributes[]> => {
    try {
        const response = await knex.raw(
            `
        SELECT
            a.*,
            COALESCE(a.color, '${Preferences.current.transit.agencies.defaultColor}') as color,
            array_remove(array_agg(l.id ORDER BY LPAD(l.shortname, 20, '0')), NULL) AS line_ids,
            array_remove(array_agg(DISTINCT u.id), NULL) AS unit_ids,
            array_remove(array_agg(DISTINCT g.id), NULL) AS garage_ids
        FROM tr_transit_agencies a
        LEFT JOIN tr_transit_lines   l ON l.agency_id = a.id
        LEFT JOIN tr_transit_units   u ON u.agency_id = a.id
        LEFT JOIN tr_transit_garages g ON g.agency_id = a.id
        WHERE a.is_enabled IS TRUE
        GROUP BY a.id
        ORDER BY COUNT(l.id) DESC, a.acronym, a.name, a.id;
    `
        );
        const collection = response.rows;
        if (collection) {
            return collection;
        }
        throw new TrError(
            'cannot fetch transit Agencies collection because database did not return a valid array',
            'TAGQGC0001',
            'TransitAgencyCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    } catch (error) {
        throw new TrError(
            `cannot fetch transit Agencies collection because of a database error (knex error: ${error})`,
            'TAGQGC0002',
            'TransitAgencyCollectionCouldNotBeFetchedBecauseDatabaseError'
        );
    }
};

/**
 * Duplicate specific agencies
 *
 * @param param The parameter object
 * @param param.agencyIds The agency IDs to duplicate
 * @param newAgencySuffix The suffix to append to the agency acronym and name
 * @param param.transaction The transaction to use for the duplication, if any
 * @returns A mapping of the ID of the agencies copied to the ID of the copy.
 */
const duplicate = async ({
    agencyIds: requestedAgencyIds = [],
    newAgencySuffix,
    transaction
}: {
    agencyIds?: string[];
    newAgencySuffix: string;
    transaction?: Knex.Transaction;
}): Promise<{ [originalAgencyId: string]: string }> => {
    const agencyIds = [...new Set(requestedAgencyIds)];
    try {
        if (agencyIds.length === 0) {
            throw new Error('There needs to be at least one agency ID to duplicate.');
        }
        agencyIds.forEach((agencyId) => {
            if (!uuidValidate(agencyId)) {
                throw new Error('Agency IDs must be valid uuids');
            }
        });

        // Agency acronym should be unique, so suffix needs to be specified
        if (_isBlank(newAgencySuffix)) {
            throw new Error('newAgencySuffix parameter needs to be set as acronyms should be unique');
        }

        const agencySelectionQuery = getIdSelectionQuery(agencyIds, tableName);
        const withClauses = joinWithClauses([agencySelectionQuery]);
        const agencyName = 'name || ?';
        const agencyAcronym = 'acronym || ?';
        const duplicateAgenciesQuery = `${withClauses.query} \
            insert into ${tableName}(internal_id, acronym, name, color, is_enabled, description, data, is_frozen, simulation_id) \
                select internal_id, ${agencyAcronym}, ${agencyName}, color, is_enabled, description, data, is_frozen, simulation_id
                from ${tableName} \
                ${agencySelectionQuery.mappedJoin} \
                order by integer_id returning id, integer_id`;

        const agencyWhereQueries = getQueryFilters([agencySelectionQuery]);
        const rawQuery = knex.raw(
            createDuplicateQueryWithIdMapping(
                tableName,
                duplicateAgenciesQuery,
                agencyWhereQueries.whereClauses.join(' and '),
                'integer_id'
            ),
            [...agencyWhereQueries.bindings, ...withClauses.bindings, ...[newAgencySuffix, newAgencySuffix]]
        );
        if (transaction) {
            rawQuery.transacting(transaction);
        }
        const agencyIdMapping = await rawQuery;

        if (agencyIdMapping.rows.length === 0) {
            return {};
        }
        return mapDuplicateIds<string>(agencyIdMapping.rows);
    } catch (error) {
        throw new TrError(
            `Cannot duplicate agencies ${agencyIds} in database (knex error: ${error})`,
            'DBAGENCY0003',
            'TransitAgencyCannotBeDuplicatedBecauseDatabaseError'
        );
    }
};

/**
 * Validate if a given suffix clashes with an already present agency for the
 * agencies in parameter. As agency acronym is a unique field, agency
 * duplication needs to duplicate with a suffix that will generate an acronym
 * that does not exist yet. This function allows to validate if it does.
 *
 * @param param0 The argument object
 * @param {string[]} param0.agencyIds The ID of the agencies to match the suffix with
 * @param {string} param0.suffix The attempted suffix to validate
 * @param {Knex.Transaction} param0.transaction An optional transaction this query is part of
 */
const isAcronymSuffixClash = async ({
    agencyIds: requestedAgencyIds,
    suffix,
    transaction
}: {
    agencyIds: string[];
    suffix: string;
    transaction?: Knex.Transaction;
}) => {
    const agencyIds = [...new Set(requestedAgencyIds)];
    try {
        agencyIds.forEach((agencyId) => {
            if (!uuidValidate(agencyId)) {
                throw new Error('Agency IDs must be valid uuids');
            }
        });

        // Suffix should not be blank
        if (_isBlank(suffix)) {
            throw new Error('suffix should not be blank');
        }

        const subQuery = knex(tableName)
            .select('id', knex.raw('(?? || ?) as ??', ['acronym', suffix, 'suffixedAcronym']))
            .as('withAcronyms');
        if (agencyIds.length > 0) {
            subQuery.whereIn('id', agencyIds);
        }

        const query = knex(`${tableName} as ag`).join(subQuery, 'ag.acronym', 'withAcronyms.suffixedAcronym');
        if (transaction) {
            query.transacting(transaction);
        }
        const existingAcronyms = await query;

        return existingAcronyms.length > 0;
    } catch (error) {
        throw new TrError(
            `Cannot verify acronym clash with suffix for agencies ${agencyIds} in database (knex error: ${error})`,
            'DBAGENCY0003',
            'TransitAgencyCannotBeDuplicatedBecauseDatabaseError'
        );
    }
};

export default {
    exists: exists.bind(null, knex, tableName),
    read: read.bind(null, knex, tableName, undefined, '*'),
    create: async (newObject: AgencyAttributes, options?: Parameters<typeof create>[4]) =>
        create(knex, tableName, attributesCleaner, newObject, options),
    createMultiple: async (newObjects: AgencyAttributes[], options?: Parameters<typeof createMultiple>[4]) =>
        createMultiple(knex, tableName, attributesCleaner, newObjects, options),
    update: async (id: string, updatedObject: Partial<AgencyAttributes>, options?: Parameters<typeof update>[5]) =>
        update(knex, tableName, attributesCleaner, id, updatedObject, options),
    updateMultiple: async (
        updatedObjects: Partial<AgencyAttributes>[],
        options?: Parameters<typeof updateMultiple>[4]
    ) => updateMultiple(knex, tableName, attributesCleaner, updatedObjects, options),
    delete: async (id: string, options?: Parameters<typeof deleteRecord>[3]) =>
        deleteRecord(knex, tableName, id, options),
    deleteMultiple: async (ids: string[], options?: Parameters<typeof deleteMultiple>[3]) =>
        deleteMultiple(knex, tableName, ids, options),
    truncate: truncate.bind(null, knex, tableName),
    destroy: destroy.bind(null, knex),
    collection,
    duplicate,
    isAcronymSuffixClash
};
