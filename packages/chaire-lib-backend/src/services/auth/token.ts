/*
 * Copyright 2024, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
export type TokenAttributes = {
    user_id: number;
    api_token?: string | null;
    expiry_date;
    creation_date;
};
