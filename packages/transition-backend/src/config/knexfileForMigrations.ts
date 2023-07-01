/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
/**
 * This file should only be used for running setup and migration tasks, the
 * other knexfile should be imported directly in other cases
 * */
import './app.config';

import knex, { onUpdateTrigger } from './knexfile';

export { onUpdateTrigger };

export default knex;
