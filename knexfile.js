require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING_PREFIX + process.env.PG_DATABASE_DEVELOPMENT,
    migrations: {
      directory: './knex/migrations'
    }
  },
  test: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING_PREFIX + process.env.PG_DATABASE_TEST,
    migrations: {
      directory: './knex/migrations'
    }
  },
  production: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING_PREFIX + process.env.PG_DATABASE_PRODUCTION,
    migrations: {
      directory: './knex/migrations'
    }
  }
};
