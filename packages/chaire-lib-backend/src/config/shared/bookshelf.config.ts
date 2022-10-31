/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import knex from './db.config';
import jsonColumns from 'bookshelf-json-columns';
import bookShelf from 'bookshelf';

export default bookShelf(knex).plugin(jsonColumns);
