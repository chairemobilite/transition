/*
 * Copyright 2026, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { Knex } from 'knex';
import { onUpdateTrigger } from '../../../config/knexfile';

const tableName = 'tr_property_registry';

/**
 * Create the property registry table.
 *
 * Schema based on the "Proposed Generic Database Schema" from the
 * Property Registry wiki documentation. Uses geography (not geometry)
 * for compatibility with the rest of the application.
 *
 * @see https://github.com/chairemobilite/transition/wiki/Documentation-%E2%80%90-Property-Registry
 */
export async function up(knex: Knex): Promise<unknown> {
    if (await knex.schema.hasTable(tableName)) {
        return;
    }
    await knex.schema.createTable(tableName, (table: Knex.TableBuilder) => {
        // Primary key
        table.increments('id').primary();

        // Source system identifier
        table.string('internal_id').index();

        // Address (temporary until we normalize addresses using a separate
        // address table with detailed address components)
        table.specificType('addresses', 'text[]');

        // Geography columns — using geography (WGS 84) rather than geometry
        table.specificType('geog_main_building_polygon', 'geography(MULTIPOLYGON)');
        table.specificType('geog_parcel_polygon', 'geography(MULTIPOLYGON)');
        table.specificType('geog_main_building_centroid_point', 'geography(POINT)');
        table.specificType('geog_parcel_centroid_point', 'geography(POINT)');
        table.specificType('geog_main_entrance_point', 'geography(POINT)');

        // Main entrance max error distance in meters
        // (max distance from the exact ground truth main entrance)
        table.integer('main_entrance_max_error_m');

        // Building characteristics
        table.integer('num_flats').index();
        table.integer('num_non_residential_units').index();
        table.integer('total_floor_area_m2').index();
        table.integer('levels').index();
        table.integer('year_built').index();
        table.string('building_type');

        // Assessment values (in original currency for now)
        // TODO: Add currency column?
        table.decimal('assessed_value_total', 15, 2);
        table.decimal('assessed_value_land', 15, 2);
        table.decimal('assessed_value_building', 15, 2);

        // Parcel
        table.integer('parcel_area_m2');
        table.string('land_use_code');

        // Location metadata
        table.specificType('country', 'CHAR(2)').index(); // ISO 3166-1 alpha-2
        table.string('region').index();
        table.string('municipality').index();
        table.string('borough').index();

        // Geography indexes:
        table.index('geog_main_building_polygon', undefined, 'gist');
        table.index('geog_parcel_polygon', undefined, 'gist');
        table.index('geog_main_building_centroid_point', undefined, 'gist');
        table.index('geog_parcel_centroid_point', undefined, 'gist');
        table.index('geog_main_entrance_point', undefined, 'gist');

        // Source data update date (distinct from our internal updated_at)
        table.timestamp('last_updated');

        // Data source FK — links to tr_data_sources for import tracking
        table.uuid('data_source_id').index();
        table.foreign('data_source_id').references('tr_data_sources.id').onDelete('CASCADE');

        // Timestamps
        table.timestamps();
    });

    return knex.raw(onUpdateTrigger(tableName));
}

export async function down(knex: Knex): Promise<unknown> {
    return knex.schema.dropTable(tableName);
}
