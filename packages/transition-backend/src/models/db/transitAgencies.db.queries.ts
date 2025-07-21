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

import { AgencyAttributes } from 'transition-common/lib/services/agency/Agency';

const tableName = 'tr_transit_agencies';

const attributesCleaner = function (attributes: Partial<AgencyAttributes>): Partial<AgencyAttributes> {
    const _attributes = _cloneDeep(attributes);
    delete _attributes.line_ids;
    delete _attributes.unit_ids;
    delete _attributes.garage_ids;
    return _attributes;
};

const collection = async ({ scenarioId }: { scenarioId?: string } = {}): Promise<AgencyAttributes[]> => {
    try {
        const agenciesQuery = knex('tr_transit_agencies as a')
            .select(
                'a.*',
                knex.raw('COALESCE(a.color, ?) as color', [Preferences.current.transit.agencies.defaultColor]),
                knex.raw('array_remove(array_agg(l.id ORDER BY LPAD(l.shortname, 20, \'0\')), NULL) AS line_ids'),
                knex.raw('array_remove(array_agg(DISTINCT u.id), NULL) AS unit_ids'),
                knex.raw('array_remove(array_agg(DISTINCT g.id), NULL) AS garage_ids')
            )
            .leftJoin('tr_transit_lines as l', 'l.agency_id', 'a.id')
            .leftJoin('tr_transit_units as u', 'u.agency_id', 'a.id')
            .leftJoin('tr_transit_garages as g', 'g.agency_id', 'a.id')
            .where('a.is_enabled', true)
            .groupBy('a.id')
            .orderByRaw('COUNT(l.id) DESC, a.acronym, a.name, a.id');
        if (scenarioId) {
            agenciesQuery
                .join('tr_transit_schedules as sched', 'sched.line_id', 'l.id')
                .join('tr_transit_services as serv', 'sched.service_id', 'serv.id')
                .join('tr_transit_scenario_services as scServ', 'scServ.service_id', 'serv.id')
                .join('tr_transit_scenarios as sc', 'sc.id', 'scServ.scenario_id')
                .where('sc.id', scenarioId)
                .whereRaw(knex.raw('(sc.only_agencies = \'{}\' or a.id = ANY(sc.only_agencies))'))
                .whereRaw(knex.raw('(sc.except_agencies = \'{}\' or a.id != ALL(sc.except_agencies))'));
        }
        const rows = await agenciesQuery;
        const collection = rows;
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
    collection
};
