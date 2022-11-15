import libKnex, { onUpdateTrigger } from 'chaire-lib-backend/lib/config/knexfile';

export { onUpdateTrigger };

export default Object.assign({}, libKnex, {
    migrations: {
        directory: __dirname + '/../models/db/migrations',
        tableName: 'knex_migrations_transition',
        loadExtensions: ['.js']
    }
});
