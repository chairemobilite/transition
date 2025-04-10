    exports.up = function(knex) {
        return knex.schema.withSchema('demo_transition').alterTable('tr_transit_schedules', function(table) {
        table.string('calculation_mode');
        });
    };
    
    exports.down = function(knex) {
        return knex.schema.withSchema('demo_transition').alterTable('tr_transit_schedules', function(table) {
        table.dropColumn('calculation_mode');
        });
    };
    