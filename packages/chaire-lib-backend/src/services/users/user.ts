import moment from 'moment';

export type UserAttributes = {
    id: number;
    uuid: string;
    username?: string | null;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_valid?: boolean | null;
    is_admin?: boolean | null;
    is_confirmed?: boolean | null;
    confirmation_token?: string | null;
    permissions?: { [key: string]: boolean } | null;
    profile?: { [key: string]: any } | null;
    preferences?: { [key: string]: any } | null;
    generated_password?: string | null;
    is_test?: boolean | null;
    google_id?: string | null;
    facebook_id?: string | null;
    // TODO Type to datetime string
    created_at?: string;
    updated_at?: string;
    password?: string | null;
    password_reset_expire_at?: moment.Moment | null;
    password_reset_token?: string | null;
    // TODO What is this?
    batch_shortname?: string | null;
};
