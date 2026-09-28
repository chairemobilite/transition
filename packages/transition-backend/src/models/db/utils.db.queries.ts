/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */

type QueryWithFilter = {
    /**
     * The where clause to use in the queries to select the records to duplicate
     * */
    whereClause?: string;
    /**
     * The values to bind in the where clause
     */
    bindings: Array<string | number>;
};

export type IdSelectionQuery = QueryWithFilter & {
    /**
     * `with` query (without the keyword) that creates the mapping table to map
     * old/duplicated record ids, or just the ids if there is no mapping
     */
    mappingWith: string;
    /**
     * The join query to use in the query that selects record to fill, to join
     * the with queries with table rows.
     */
    mappedJoin: string;
    /**
     * Values bound in the mapping CTE, in SQL placeholder order.
     */
    mappingBindings: Array<string | number>;
};

export type IdMappingQuery = IdSelectionQuery & {
    /**
     * The field to use in the select/insert queries. It will be the field
     * itself if there is no mapping, otherwise, it's the mapeed duplicated id.
     */
    mappedField: string;
};

/**
 * Return the where clauses and bindings from an array of query getQueryFilters
 * @param queries The query filter objects
 *
 * @returns The where clauses and bindings, only if the query filters actually
 * have such clauses.
 */
export const getQueryFilters = (
    queries: Array<QueryWithFilter>
): { whereClauses: string[]; bindings: Array<string | number> } => {
    const filteredQueries = queries.filter(
        (query): query is { whereClause: string; bindings: Array<string | number> } => query.whereClause !== undefined
    );
    return {
        whereClauses: filteredQueries.map((query) => query.whereClause),
        bindings: filteredQueries.flatMap((query) => query.bindings)
    };
};

/**
 * Build SQL fragments for mapping original foreign-key IDs to their copies. If
 * the mapping is empty, it returns empty queries that will allow to copy the
 * object's current foreign key field values in the duplicated object.
 *
 * @param args
 * @param {Record<string, string>} args.idMapping A mapping of ids, where they key is
 * the original id and the value is the duplicated id. Can be empty if there is
 * no duplicated foreign object, in which case, the ids will be unchanged
 * @param {string} args.mappedKey A key for this mapping, used to name the mapping
 * query an fields. It needs to match the foreign key field, without the `_id`
 * part. For example, if the field is `line_id`, the mappedKey should be 'line'.
 * @param {string} args.tableName The name of the table with the foreign key.
 * @param {boolean} args.canBeNull Whether the foreign key field can be null or not.
 * If it can be `null`, the table join will use a left join, while an inner join
 * will be used if it cannot be null.
 */
export const getIdMappingQuery = (
    idMapping: Record<string, string> | Record<number, number>,
    mappedKey: string,
    tableName: string,
    canBeNull = false
): IdMappingQuery => {
    const originalIds = Object.keys(idMapping);
    if (originalIds.length === 0) {
        return {
            whereClause: undefined,
            bindings: [],
            mappingWith: '',
            mappedField: `${mappedKey}_id`,
            mappedJoin: '',
            mappingBindings: []
        };
    }

    // Object keys are always strings at runtime. Inspect the mapped value to
    // determine whether this is a UUID mapping or a numeric mapping.
    const hasNumericIds = typeof idMapping[originalIds[0]] === 'number';
    const sourceIds = hasNumericIds
        ? originalIds.map((id) => {
            const numericId = Number(id);
            if (!Number.isSafeInteger(numericId)) {
                throw new Error(`Cannot use non-integer source ID "${id}" in a numeric ID mapping`);
            }
            return numericId;
        })
        : originalIds;
    const cast = hasNumericIds ? 'integer' : 'uuid';
    return {
        whereClause: `${mappedKey}_id in (${sourceIds.map(() => '?').join(', ')})`,
        bindings: sourceIds,
        mappingWith: `${mappedKey}_mapping (original_id, new_id) as (values ${originalIds
            .map(() => `(?::${cast}, ?::${cast})`)
            .join(', ')})`,
        mappedField: `${mappedKey}_mapping.new_id`,
        mappedJoin: `${canBeNull ? 'left ' : ''}join ${mappedKey}_mapping on ${mappedKey}_mapping.original_id = ${tableName}.${mappedKey}_id`,
        mappingBindings: originalIds.flatMap((originalId, index) => [sourceIds[index], idMapping[originalId]])
    };
};

/**
 * Build SQL fragments for selecting a set of source rows through a CTE (Common
 * table expression). This uniformizes the query, such that either mapping or
 * selection use a similar approach.
 *
 * @param args
 *
 * @param {Record<string, string>} args.idMapping A mapping of ids, where they key is
 * the original id and the value is the duplicated id. Can be empty if there is
 * no duplicated foreign object, in which case, the ids will be unchanged
 * @param {string} args.mappedKey A key for this mapping, used to name the mapping
 * query an fields. It needs to match the foreign key field, without the `_id`
 * part. For example, if the field is `line_id`, the mappedKey should be 'line'.
 * @param {string} args.tableName The name of the table with the foreign key.
 * @param {boolean} args.selectionColumn Name of the id column, to match with the
 * selected ids
 */
export const getIdSelectionQuery = (ids: string[], tableName: string, selectionColumn = 'id'): IdSelectionQuery => {
    if (ids.length === 0) {
        return {
            whereClause: undefined,
            bindings: [],
            mappingWith: '',
            mappedJoin: '',
            mappingBindings: []
        };
    }

    return {
        whereClause: `${selectionColumn} in (${ids.map(() => '?').join(', ')})`,
        bindings: ids,
        mappingWith: `${tableName}_selection(${selectionColumn}) as (values ${ids.map(() => '(?::uuid)').join(', ')})`,
        mappedJoin: `join ${tableName}_selection on ${tableName}_selection.${selectionColumn} = ${tableName}.${selectionColumn}`,
        mappingBindings: ids
    };
};

export interface WithClauses {
    query: string;
    bindings: Array<string | number>;
}

/**
 * Join mapping CTE declarations in order and return their parameter bindings
 * alongside the SQL.
 */
export const joinWithClauses = (queries: IdSelectionQuery[]): WithClauses => {
    const nonEmptyQueries = queries.filter((query) => query.mappingWith !== '');
    return {
        query:
            nonEmptyQueries.length > 0 ? `with ${nonEmptyQueries.map((query) => query.mappingWith).join(', ')} ` : '',
        bindings: nonEmptyQueries.flatMap((query) => query.mappingBindings)
    };
};

/**
 * Build the common SQL wrapper that pairs each duplicated row with its source.
 * When specifying the bindings for this raw query, the first ones are those
 * used by the `whereClause` passed in parameters, then those used in the
 * `duplicateQuery` part.
 *
 * @param args
 * @param {string} args.tableName The name of the table with the rows to
 * duplicate
 * @param {string} args.duplicateQuery The raw duplication query that will
 * do the insert. Typically an insert .. select query. The select part should
 * make sure the rows are ordered by the same field as the args.orderBy field,
 * otherwise, it will not be possible to match old/new mappings.
 * @param {string} args.whereClause The where clause, it should match the where clause of the duplicate query
 * @param {string} args.orderBy Name of the field to order by the query. This
 * should be an incremental integer id, such that insertion order is guaranteed.
 * The insertion query should make sure to also order the rows by this field,
 * such that the row number can be used as a join to match the duplicated row
 * with the original one.
 * @returns The raw query to execute in knex to duplicate the rows in table.
 */
export const createDuplicateQueryWithIdMapping = (
    tableName: string,
    duplicateQuery: string,
    whereClause: string,
    orderBy: string
): string =>
    // The `sel` part selects the original ids and row numbers
    // for where clause, if specified and order them by row ID,
    // the `ins` part duplicates the schedules, also ordered by ID and
    // returns the new IDs. Both `sel` and `ins` have the same number of
    // rows and the same order of elements. The last select matches the
    // original and new IDs from the row number, effectively giving the
    // mapping between old and new schedules.
    `with sel as (select id, row_number() over (order by ${orderBy}) as rn from ${tableName} where ${whereClause} order by ${orderBy}), \
ins as (${duplicateQuery}) \
select i.id, s.id as from_id from (select id, row_number() over (order by ${orderBy}) as rn from ins) i \
join sel s using(rn)`;

/**
 * Convert rows returned by the mapping query into an original-to-duplicate map.
 */
export const mapDuplicateIds = <TData extends string | number>(
    rows: Array<{ from_id: TData; id: TData }>
): Record<TData, TData> =>
        rows.reduce(
            (mapping, row) => {
                mapping[row.from_id] = row.id;
                return mapping;
            },
        {} as Record<TData, TData>
        );
