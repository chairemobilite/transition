/*
 * Copyright 2022, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import '../../config/dotenv.config'; // Unused, but must be imported
import { CreateUser } from '../../tasks/user/createUser';
import taskWrapper from '../../tasks/taskWrapper';

taskWrapper(new CreateUser())
    .then(() => {
        process.exit();
    })
    .catch((err) => {
        console.error('Error executing task', err);
        process.exit();
    });
