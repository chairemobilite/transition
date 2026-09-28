/*
 * Copyright Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import {
    createDuplicateQueryWithIdMapping,
    joinWithClauses,
    getIdMappingQuery,
    getIdSelectionQuery,
    getQueryFilters,
    mapDuplicateIds
} from '../utils.db.queries';

describe('getIdMappingQuery', () => {
    test('returns default query fragments for an empty mapping', () => {
        expect(getIdMappingQuery({}, 'line', 'tr_transit_schedules')).toEqual({
            mappingWith: '',
            mappedField: 'line_id',
            mappedJoin: '',
            whereClause: undefined,
            bindings: [],
            mappingBindings: []
        });
    });

    describe('getIdMappingQuery with returned rows', () => {
        test('builds an integer mapping CTE with filters and casts for schedule IDs', () => {
            expect(
                getIdMappingQuery(
                    mapDuplicateIds<number>([
                        { from_id: 12, id: 14 },
                        { from_id: 13, id: 15 }
                    ]),
                    'schedule',
                    'tr_transit_schedule_periods'
                )
            ).toEqual({
                mappingWith:
                    'schedule_mapping (original_id, new_id) as (values (?::integer, ?::integer), (?::integer, ?::integer))',
                mappedField: 'schedule_mapping.new_id',
                mappedJoin:
                    'join schedule_mapping on schedule_mapping.original_id = tr_transit_schedule_periods.schedule_id',
                whereClause: 'schedule_id in (?, ?)',
                bindings: [12, 13],
                mappingBindings: [12, 14, 13, 15]
            });
        });
    });

    test('builds mapping fragments for populated mappings', () => {
        expect(
            getIdMappingQuery(
                { original1: 'duplicate1', original2: 'duplicate2' },
                'path',
                'tr_transit_schedule_periods',
                true
            )
        ).toEqual({
            mappingWith: 'path_mapping (original_id, new_id) as (values (?::uuid, ?::uuid), (?::uuid, ?::uuid))',
            mappedField: 'path_mapping.new_id',
            mappedJoin:
                'left join path_mapping on path_mapping.original_id = tr_transit_schedule_periods.path_id',
            whereClause: 'path_id in (?, ?)',
            bindings: ['original1', 'original2'],
            mappingBindings: ['original1', 'duplicate1', 'original2', 'duplicate2']
        });
    });
});

describe('getIdSelectionQuery', () => {
    test('returns default query fragments for an empty ID list', () => {
        expect(getIdSelectionQuery([], 'tr_transit_paths')).toEqual({
            mappingWith: '',
            mappedJoin: '',
            whereClause: undefined,
            bindings: [],
            mappingBindings: []
        });
    });

    test('builds a selection CTE for populated ID lists', () => {
        expect(getIdSelectionQuery(['path1', 'path2'], 'tr_transit_paths')).toEqual({
            mappingWith: 'tr_transit_paths_selection(id) as (values (?::uuid), (?::uuid))',
            mappedJoin: 'join tr_transit_paths_selection on tr_transit_paths_selection.id = tr_transit_paths.id',
            whereClause: 'id in (?, ?)',
            bindings: ['path1', 'path2'],
            mappingBindings: ['path1', 'path2']
        });
    });
});

describe('getQueryFilters', () => {
    test('combines defined where clauses and their bindings', () => {
        expect(
            getQueryFilters([
                { whereClause: 'line_id in (?, ?)', bindings: ['line1', 'line2'] },
                { whereClause: undefined, bindings: [] },
                { whereClause: 'service_id in (?)', bindings: ['service1'] }
            ])
        ).toEqual({
            whereClauses: ['line_id in (?, ?)', 'service_id in (?)'],
            bindings: ['line1', 'line2', 'service1']
        });
    });
});

describe('joinWithClauses', () => {
    test('joins non-empty CTE declarations and groups their bindings in declaration order', () => {
        const firstMapping = getIdMappingQuery({ first: 'first_copy' }, 'line', 'schedules');
        const emptyMapping = getIdMappingQuery({}, 'service', 'schedules');
        const lastMapping = getIdMappingQuery(
            mapDuplicateIds<number>([{ from_id: 2, id: 3 }]),
            'schedule',
            'periods'
        );

        expect(joinWithClauses([firstMapping, emptyMapping, lastMapping])).toEqual({
            query:
                'with line_mapping (original_id, new_id) as (values (?::uuid, ?::uuid)), schedule_mapping (original_id, new_id) as (values (?::integer, ?::integer)) ',
            bindings: ['first', 'first_copy', 2, 3]
        });
    });

    test('returns empty SQL and bindings when all declarations are empty', () => {
        expect(
            joinWithClauses([
                getIdMappingQuery({}, 'line', 'schedules'),
                getIdSelectionQuery([], 'paths')
            ])
        ).toEqual({
            query: '',
            bindings: []
        });
    });
});

describe('createDuplicateQueryWithIdMapping', () => {
    test('builds source-to-duplicate mapping SQL', () => {
        expect(
            createDuplicateQueryWithIdMapping('tr_transit_paths', 'insert into tr_transit_paths returning id', 'id in (?)', 'integer_id')
        ).toBe(
            'with sel as (select id, row_number() over (order by integer_id) as rn from tr_transit_paths where id in (?) order by integer_id), ' +
                'ins as (insert into tr_transit_paths returning id) ' +
                'select i.id, s.id as from_id from (select id, row_number() over (order by integer_id) as rn from ins) i ' +
                'join sel s using(rn)'
        );
    });
});

describe('mapDuplicateIds', () => {
    test.each([
        { title: 'empty data', rows: [], expected: {} },
        {
            title: 'string data',
            rows: [{ from_id: 'source1', id: 'copy1' }, { from_id: 'source2', id: 'copy2' }],
            expected: { source1: 'copy1', source2: 'copy2' }
        },
        {
            title: 'number data',
            rows: [{ from_id: 1, id: 100 }, { from_id: 2, id: 101 }],
            expected: { 1: 100, 2: 101 }
        }
    ])('%', ({ rows, expected }) => {
        expect(mapDuplicateIds(rows as any)).toEqual(expected);
    });
});
