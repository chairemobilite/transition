/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import { knex } from 'knex';

// Mock the database connection. There should be no real DB access in unit
// tests (it's an error if there is, DB accesses should be in the sequential
// tests), so this is just a placeholder.
export default knex({ client: 'sqlite' });
