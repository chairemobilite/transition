/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import path from 'path';

if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
}
export default require('dotenv').config({ path: path.join(__dirname, '../../../../../..', '.env') });
