/*
 * Copyright 2023, Polytechnique Montreal and contributors
 *
 * This file is licensed under the MIT License.
 * License text available at https://opensource.org/licenses/MIT
 */
import moment from 'moment';

export type UserAttributesBase = {
    id: number;
    username?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_valid?: boolean | null;
    is_confirmed?: boolean | null;
    confirmation_token?: string | null;
    profile?: { [key: string]: any } | null;
    preferences?: { [key: string]: any } | null;
    generated_password?: string | null;
    google_id?: string | null;
    facebook_id?: string | null;
    // TODO Type to datetime string
    created_at?: string;
    updated_at?: string;
    password?: string | null;
    password_reset_expire_at?: moment.Moment | null;
    password_reset_token?: string | null;
};

export type UserAttributes = UserAttributesBase & {
    uuid: string;
    is_admin?: boolean | null;
    permissions?: { [key: string]: boolean } | null;
    is_test?: boolean | null;
    // TODO What is this?
    batch_shortname?: string | null;
};
