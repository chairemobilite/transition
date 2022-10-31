/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import Knex from 'knex';
import dbOptions from '../knexfile';

export default Knex(dbOptions);
